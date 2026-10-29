// Talks to Supabase: Auth for accounts, supabase-js reads under RLS, writes through Postgres functions (supabase/migrations).
// Pages still call api("/path"): each path the old NestJS API had maps to a route below, so pages didn't change.
// NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set per environment (.env.local for dev).
// While they're unset, the account pages show "opens soon" instead of forms that can't work.
import { createBrowserClient } from "@supabase/ssr";
import type { AuthError, PostgrestError } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const apiReady = SUPABASE_URL !== "" && SUPABASE_KEY !== "";
// Session lives in cookies (@supabase/ssr), so server code can read it later.
export const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
// Log in / registration pages work once Supabase is configured; student sign-up still needs NEXT_PUBLIC_STUDENT_SIGNUP=open.
export const accountsOpen = apiReady;
// Ambassadors sign up via Google Forms at /ambassador. Set to "open" (with STUDENT_SIGNUP=open on the API) to open student sign-up.
export const studentSignupOpen = process.env.NEXT_PUBLIC_STUDENT_SIGNUP === "open";
// Site-wide "Log in" and "Registration" buttons.
export const LOGIN_HREF = "/login";
export const REGISTER_HREF = "/registration";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {}, // field name -> message, from validation errors
    public body: Record<string, unknown> | null = null, // the whole error response, for extras like `student`
  ) {
    super(message);
  }
}

const OFFLINE = "Can't reach AVANTRA right now. Check your connection and try again.";
const INVALID_LOGIN = "Invalid email or password";

// Supabase Auth / PostgREST error -> ApiError. Database functions put the field name in HINT.
function fail(e: AuthError | PostgrestError): never {
  // PTxxx = the HTTP status the function chose (PT404 -> 404).
  const code = "status" in e ? "" : e.code;
  const status = "status" in e ? (e.status ?? 0) : /^PT\d{3}$/.test(code) ? Number(code.slice(2)) : ({ "42501": 403, "23505": 409, P0001: 400 } as Record<string, number>)[code] ?? 500;
  if (status === 429) throw new ApiError(429, "Too many attempts. Try again in a minute.");
  if (/fetch|network/i.test(e.message)) throw new ApiError(0, OFFLINE);
  const hint = "hint" in e ? e.hint : "";
  // Functions put extras (like the scanned student's card) in DETAIL as JSON.
  let body: Record<string, unknown> | null = null;
  try {
    body = "details" in e && e.details ? JSON.parse(e.details) : null;
  } catch {}
  throw new ApiError(status || 400, e.message, hint ? { [hint]: e.message } : {}, body);
}
const ok = <T>({ data, error }: { data: T; error: AuthError | PostgrestError | null }) => (error ? fail(error) : data);

async function me(): Promise<Me> {
  const sb = supabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new ApiError(401, "Log in first");
  const u = ok(await sb.from("User").select("id, email, name, role, disabledAt, expiresAt, Student(userId)").eq("id", auth.user.id).maybeSingle());
  // Switched off by an admin, or a staff account past its end date: same as logged out.
  if (!u || u.disabledAt || (u.expiresAt && new Date(u.expiresAt) <= new Date())) throw new ApiError(401, "Log in first");
  return { id: u.id, email: u.email, name: u.name, role: u.role, profileComplete: u.role !== "STUDENT" || !!u.Student };
}

// Password log in for the given roles. One message for every failure, including the wrong page, so it never reveals the account type.
async function login({ email, password }: { email: string; password: string }, roles: Role[]): Promise<Me> {
  const sb = supabase();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error.status === 400 ? new ApiError(401, INVALID_LOGIN) : fail(error);
  const m = await me().catch(() => null);
  if (m && roles.includes(m.role)) return m;
  await sb.auth.signOut({ scope: "local" });
  throw new ApiError(401, INVALID_LOGIN);
}

// The request body, plus the path's :params and ?query values.
type Body = Record<string, string>;
const rpc = async (fn: string, args?: object) => ok(await supabase().rpc(fn, args));
// POST to a route handler of this site; its { message, errors } error body becomes an ApiError.
async function post(path: string, body: object) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.message ?? OFFLINE, {}, data);
  return data;
}
const routes: Record<string, (body: Body) => Promise<unknown>> = {
  // Sign-up: Supabase emails a 6-digit code (the Confirm signup template shows {{ .Token }}). An existing email gets no email and the same answer.
  "POST /auth/register": async ({ name, email, password }) => {
    const { error } = await supabase().auth.signUp({ email, password, options: { data: { name } } });
    if (error?.code === "signup_disabled") throw new ApiError(403, "Student registration opens soon");
    if (error) fail(error);
  },
  "POST /auth/register/verify": async ({ email, code }) => {
    const { error } = await supabase().auth.verifyOtp({ email, token: code, type: "email" });
    if (error) throw error.status === 429 ? fail(error) : new ApiError(400, "Invalid or expired code");
    return me();
  },
  "POST /auth/login": (b) => login(b as never, ["STUDENT"]),
  "POST /auth/staff/login": (b) => login(b as never, ["VOLUNTEER", "JUDGE"]),
  "POST /auth/admin/login": (b) => login(b as never, ["ADMIN"]),
  "POST /auth/logout": async () => void (await supabase().auth.signOut()),
  "GET /auth/me": me,
  "POST /auth/password/forgot": async ({ email }) => void ok(await supabase().auth.resetPasswordForEmail(email)),
  // The code logs in for a moment; the new password then logs out every device, like before.
  "POST /auth/password/reset": async ({ email, code, password }) => {
    const sb = supabase();
    const { error } = await sb.auth.verifyOtp({ email, token: code, type: "recovery" });
    if (error) throw error.status === 429 ? fail(error) : new ApiError(400, "Invalid or expired code");
    const updated = await sb.auth.updateUser({ password });
    if (updated.error) fail(updated.error);
    await sb.auth.signOut({ scope: "global" });
  },

  "GET /events": async () => ok(await supabase().rpc("events_list")),

  // Same shape as the old GET /profile: the latest payment only, and days through the main gate.
  "GET /profile": async () => {
    const { id } = await me();
    const s = ok(
      await supabase()
        .from("Student")
        .select("*, Payment(method, status, utr, createdAt), CheckIn(count)")
        .eq("userId", id)
        .is("CheckIn.eventId", null)
        .order("createdAt", { referencedTable: "Payment", ascending: false })
        .limit(1, { referencedTable: "Payment" })
        .maybeSingle(),
    );
    if (!s) return { student: null };
    const { Payment, CheckIn, ...student } = s;
    return { student: { ...student, payments: Payment, _count: { checkIns: CheckIn[0]?.count ?? 0 } } };
  },
  "POST /profile/student": async (profile) => ok(await supabase().rpc("create_student_profile", { profile })),

  // Event entries and teams: supabase/migrations/*_registrations_and_teams.sql
  "GET /registrations/mine": () => rpc("my_registrations"),
  "POST /registrations": ({ eventId }) => rpc("register_event", { p_event_id: eventId }),
  "DELETE /registrations/:id": ({ id }) => rpc("withdraw_registration", { p_registration_id: id }),
  "GET /teams": ({ eventId }) => rpc("open_teams", { p_event_id: eventId }),
  "POST /teams": ({ eventId, name, projectTitle, topic }) => rpc("create_team", { p_event_id: eventId, p_name: name, p_project_title: projectTitle, p_topic: topic }),
  "POST /teams/join": ({ inviteCode }) => rpc("join_team", { p_invite_code: inviteCode }),
  "POST /teams/:id/requests": ({ id }) => rpc("request_join", { p_team_id: id }),
  "POST /teams/:id/requests/:reg/accept": ({ id, reg }) => rpc("accept_join", { p_team_id: id, p_registration_id: reg }),
  "DELETE /teams/:id/requests/:reg": ({ id, reg }) => rpc("drop_join_request", { p_team_id: id, p_registration_id: reg }),
  "POST /teams/:id/leave": ({ id }) => rpc("leave_team", { p_team_id: id }),
  "DELETE /teams/:id/members/:reg": ({ id, reg }) => rpc("remove_member", { p_team_id: id, p_registration_id: reg }),
  "POST /teams/:id/invite-code": ({ id }) => rpc("new_invite_code", { p_team_id: id }),

  // Fee by UPI and the Engagement Wall: supabase/migrations/*_fee_and_wall.sql
  "POST /payments/upi": ({ utr }) => rpc("submit_upi_payment", { p_utr: utr }),
  "GET /wall/me": () => rpc("wall_me"),
  "GET /wall/challenges/:code": ({ code }) => rpc("wall_challenge", { p_code: code }),
  "POST /wall/challenges/:code/answer": ({ code, answer }) => rpc("wall_answer", { p_code: code, p_answer: answer }),
  // Volunteers, judges and the certificate check: supabase/migrations/*_staff_and_certificates.sql
  "POST /staff/checkin": ({ qrToken, avantraId, eventId, scannedAt }) =>
    rpc("staff_checkin", { p_qr_token: qrToken, p_avantra_id: avantraId, p_event_id: eventId, p_scanned_at: scannedAt }),
  "GET /staff/my-scans": () => rpc("staff_my_scans"),
  "GET /staff/students": ({ q }) => rpc("staff_find_students", { p_q: q }),
  "GET /staff/judge/teams": () => rpc("judge_teams"),
  "POST /staff/judge/lookup": ({ qrToken, avantraId }) => rpc("judge_lookup", { p_qr_token: qrToken, p_avantra_id: avantraId }),
  "GET /staff/judge/teams/:id": ({ id }) => rpc("judge_team", { p_team_id: id }),
  "POST /staff/judge/scores": ({ teamId, scores }) => rpc("judge_submit_scores", { p_team_id: teamId, p_scores: scores }),
  "GET /certificates/:code": ({ code }) => rpc("certificate", { p_code: code }),

  // Admin desk: supabase/migrations/*_admin.sql. Every function checks the caller is an admin.
  "GET /admin/stats": () => rpc("admin_stats"),
  "GET /admin/referrals": () => rpc("admin_referrals"),
  "GET /admin/payments/upi": () => rpc("admin_upi_waiting"),
  "POST /admin/students/:id/mark-paid": ({ id, note }) => rpc("admin_mark_paid", { p_avantra_id: id, p_note: note }),
  "PATCH /admin/events/:id": ({ id, registrationOpen }) => rpc("admin_set_registration_open", { p_event_id: id, p_open: registrationOpen }),
  "GET /admin/events/:id/leaderboard": ({ id }) => rpc("admin_event_leaderboard", { p_event_id: id }),
  "POST /admin/teams/:id/rank": ({ id, rank }) => rpc("admin_set_rank", { p_team_id: id, p_rank: rank }),
  "POST /admin/events/:id/certificates": ({ id }) => rpc("admin_issue_certificates", { p_event_id: id }),
  "GET /admin/staff": () => rpc("admin_staff"),
  "POST /admin/staff/:id/assign": ({ id, eventId }) => rpc("admin_assign_judge", { p_user_id: id, p_event_id: eventId }),
  "POST /admin/users/:id/disable": ({ id }) => rpc("admin_set_disabled", { p_user_id: id, p_disabled: true }),
  "POST /admin/users/:id/enable": ({ id }) => rpc("admin_set_disabled", { p_user_id: id, p_disabled: false }),
  "GET /admin/wall": () => rpc("admin_wall"),
  "PUT /admin/wall/state": ({ open, frozen }) => rpc("admin_wall_state", { p_open: open, p_frozen: frozen }),
  "PATCH /admin/wall/challenges/:id": ({ id, active, answers }) =>
    answers ? rpc("admin_wall_set_answers", { p_challenge_id: id, p_answers: answers }) : rpc("admin_wall_set_active", { p_challenge_id: id, p_active: active }),
  "POST /admin/wall/challenges/:id/new-code": ({ id }) => rpc("admin_wall_new_code", { p_challenge_id: id }),
  "DELETE /admin/wall/challenges/:id/students/:avantraId": ({ id, avantraId }) => rpc("admin_wall_reset", { p_challenge_id: id, p_avantra_id: avantraId }),

  // Uploads go to this site's route handlers (app/admin/**/route.ts), which read the sheet on the server.
  "POST /admin/payments/upi/import": (b) => post("/admin/payments/upi/import", b),
  "POST /admin/wall/import": (b) => post("/admin/wall/import", b),
  // Making accounts needs the secret key, so these run on the server too.
  "POST /admin/staff": (b) => post("/admin/staff", b),
  "POST /admin/walk-in": (b) => post("/admin/walk-in", b),

  // "Write to the team": queued as an email to the team, reply-to the sender. A filled `website` trap field = a bot: pretend it worked.
  "POST /contact": async ({ name, school, email, message, website }) => {
    if (!website) await rpc("contact_message", { p_name: name, p_email: email, p_message: message, p_school: school ?? null });
  },

  "GET /wall/leaderboard": async () => {
    const res = await fetch("/wall/leaderboard.json");
    if (!res.ok) throw new ApiError(res.status, "Leaderboard unavailable. Try again in a moment.");
    return res.json();
  },
};

export async function api<T = unknown>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const [pathname, query] = path.split("?");
  for (const [key, route] of Object.entries(routes)) {
    const [m, pattern] = key.split(" ");
    const names: string[] = [];
    const hit = m === method && pathname.match(new RegExp("^" + pattern.replace(/:(\w+)/g, (_, n) => (names.push(n), "([^/]+)")) + "$"));
    if (!hit) continue;
    const params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(hit[i + 1])]));
    return call<T>(() => route({ ...Object.fromEntries(new URLSearchParams(query)), ...(body as Body), ...params }));
  }
  throw new ApiError(503, "This part of AVANTRA opens soon.");
}

async function call<T>(run: () => Promise<unknown>): Promise<T> {
  try {
    return (await run()) as T;
  } catch (e) {
    throw e instanceof ApiError ? e : new ApiError(0, OFFLINE);
  }
}

export type Role = "STUDENT" | "JUDGE" | "VOLUNTEER" | "ADMIN";
export type Me = { id: string; email: string; name: string; role: Role; profileComplete: boolean };

// localStorage key: referral code from a share link (/registration?ref=CODE), filled in on the profile step.
export const REF_KEY = "avantra.ref";

// null = not logged in
export const getMe = () => api<Me>("/auth/me").catch((e) => (e instanceof ApiError && e.status === 401 ? null : Promise.reject(e)));

// How students pay the ₹199 exhibition fee: "upi" (default) = the school's QR + UTR, checked by the school in Excel;
// "razorpay" = Razorpay Checkout (needs the RAZORPAY_* keys on the API). Kept for reuse at other events.
export const paymentMode = process.env.NEXT_PUBLIC_PAYMENTS === "razorpay" ? "razorpay" : "upi";

// The latest fee payment, from GET /profile (student.payments). Shows "under review" or "failed, try again".
export type LastPayment = { method: "ONLINE" | "OFFLINE" | "UPI"; status: "CREATED" | "PAID" | "FAILED" | "REFUNDED"; utr: string | null; createdAt: string };

// ₹199 Science Exhibition fee through Razorpay Checkout. Resolves once the API has confirmed the
// payment; rejects with an ApiError if it fails. Closing the popup just resolves `false`.
export async function payExhibitionFee(me: Me): Promise<boolean> {
  const o = await api<{ keyId: string; orderId: string; amount: number; currency: string; description: string }>("/payments/fee", {});
  const w = window as unknown as { Razorpay?: new (opts: object) => { open(): void } };
  if (!w.Razorpay) {
    await new Promise<void>((ok, fail) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => ok();
      s.onerror = () => fail(new ApiError(0, "Couldn't open the payment window. Check your connection and try again."));
      document.body.append(s);
    });
  }
  return new Promise((ok, fail) =>
    new w.Razorpay!({
      key: o.keyId,
      order_id: o.orderId,
      amount: o.amount,
      currency: o.currency,
      name: "AVANTRA 2026",
      description: o.description,
      prefill: { name: me.name, email: me.email },
      theme: { color: "#9d0006" },
      handler: (r: object) => api("/payments/verify", r).then(() => ok(true), fail),
      modal: { ondismiss: () => ok(false) },
    }).open(),
  );
}
