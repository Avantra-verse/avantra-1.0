// Attacker-style checks against a live project, using only the publishable key (what a browser has).
// Usage (from apps/web):
//   SUPABASE_URL=… SUPABASE_KEY=sb_publishable_… E2E_PASSWORD=… node scripts/access.e2e.mjs
// Needs three confirmed STUDENT accounts e2e-student@, e2e-student2@ and e2e-student3@avantra.test with that password.
// Safe to re-run: it makes their profiles once and withdraws every entry it makes.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_KEY, E2E_PASSWORD } = process.env;
const client = () => createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const TABLES = ["User", "Student", "Event", "Registration", "Team", "TeamMember", "TeamJoinRequest", "Payment", "CheckIn", "Score", "WallChallenge", "WallAttempt", "WallSolve", "Setting"];
const good = { phone: "9876543210", grade: 9, schoolName: "SSRVM IEMS", guardianConsent: true, referralCode: "abc123" };

// Logs in; makes the profile if it's missing. Returns the client and its user id.
async function student(email) {
  const sb = client();
  const login = await sb.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  assert.equal(login.error, null, email);
  const { data } = await sb.from("Student").select("userId");
  if (!data.length) assert.equal((await sb.rpc("create_student_profile", { profile: good })).error, null);
  return { sb, uid: login.data.user.id };
}
// The error code of a call that must fail.
const code = async (call) => {
  const { error } = await call;
  assert.ok(error, "expected an error");
  return error.code;
};

// ---- logged out ----
const anon = client();
const events = await anon.rpc("events_list");
assert.equal(events.error, null);
assert.equal(events.data.length, 9, "9 seeded events");
const ev = Object.fromEntries(events.data.map((e) => [e.slug, e.id]));
for (const t of TABLES.filter((t) => t !== "Event")) {
  const { data } = await anon.from(t).select("*");
  assert.ok(!data?.length, `anon reads nothing from ${t}`);
}
assert.ok((await anon.rpc("create_student_profile", { profile: {} })).error, "anon can't make a profile");
assert.ok((await anon.rpc("register_event", { p_event_id: ev.drone })).error, "anon can't register");
assert.ok((await anon.from("Event").insert({ slug: "x", name: "x", category: "WORKSHOP" })).error, "anon can't write events");
assert.ok((await anon.rpc("admin_walk_in", { p_user_id: crypto.randomUUID(), p_profile: good })).error, "anon can't make walk-ins");
assert.ok((await anon.rpc("admin_staff_setup", { p_user_id: crypto.randomUUID() })).error, "anon can't make staff");
assert.equal((await anon.rpc("contact_message", { p_name: "E2E", p_email: "not-an-email", p_message: "Hello team" })).error?.hint, "email", "contact form checks the email");

// ---- profile step (first account; checks validation if its profile isn't made yet) ----
{
  const sb = client();
  const login = await sb.auth.signInWithPassword({ email: "e2e-student@avantra.test", password: E2E_PASSWORD });
  assert.equal(login.error, null);
  const uid = login.data.user.id;
  if (!(await sb.from("Student").select("userId")).data.length) {
    assert.equal((await sb.rpc("create_student_profile", { profile: { ...good, phone: "12345" } })).error?.hint, "phone", "server checks the phone");
    assert.equal((await sb.rpc("create_student_profile", { profile: { ...good, guardianConsent: "true" } })).error?.hint, "consent", "consent must be JSON true");
    const made = await sb.rpc("create_student_profile", { profile: good });
    assert.equal(made.error, null);
    assert.match(made.data.avantraId, /^AV26-[2-9A-HJ-NP-Z]{5}$/);
    assert.equal(made.data.referralCode, "ABC123");
  }
  assert.equal(await code(sb.rpc("create_student_profile", { profile: good })), "23505", "one profile per student");
  assert.deepEqual((await sb.from("User").select("id, role")).data, [{ id: uid, role: "STUDENT" }], "sees only own User row");
  // Direct writes are revoked: no self-promotion, no fake paid fee, no free profile.
  assert.ok((await sb.from("User").update({ role: "ADMIN" }).eq("id", uid)).error, "can't change own role");
  assert.ok((await sb.from("Student").update({ feePaidAt: new Date().toISOString() }).eq("userId", uid)).error, "can't mark own fee paid");
  assert.ok((await sb.from("Payment").insert({ studentId: uid, amountPaise: 1, status: "PAID" })).error, "can't insert Payment");
  assert.equal((await sb.auth.updateUser({ data: { role: "ADMIN" } })).error, null); // metadata is editable…
  assert.deepEqual((await sb.from("User").select("role")).data, [{ role: "STUDENT" }], "…but never used for roles");
}

// ---- registrations and teams ----
const a = await student("e2e-student@avantra.test");
const b = await student("e2e-student2@avantra.test");
const c = await student("e2e-student3@avantra.test");
for (const t of ["Team", "TeamMember", "TeamJoinRequest", "Score", "WallChallenge", "Setting"]) {
  assert.ok(!(await a.sb.from(t).select("*")).data?.length, `student reads nothing from ${t} directly`);
}
assert.equal((await b.sb.from("Student").select("userId")).data.length, 1, "sees only own Student row");

assert.equal(await code(a.sb.rpc("register_event", { p_event_id: ev.exhibition })), "PT403", "exhibition needs the fee");
assert.equal(await code(a.sb.rpc("create_team", { p_event_id: ev.drone, p_name: "Rotor" })), "PT403", "register before a team");

// Solo event: a team of one is made, and withdrawing removes it.
const solo = (await a.sb.rpc("register_event", { p_event_id: ev.vr })).data;
assert.equal(await code(a.sb.rpc("register_event", { p_event_id: ev.vr })), "PT409", "one entry per event");
let mine = (await a.sb.rpc("my_registrations")).data;
assert.equal(mine.find((r) => r.id === solo).teamMember.team.members.length, 1, "solo team of one");
assert.equal((await a.sb.rpc("withdraw_registration", { p_registration_id: solo })).error, null);
assert.equal(await code(b.sb.rpc("withdraw_registration", { p_registration_id: solo })), "PT404");

// Team event: A leads, B joins by code, C asks and A accepts. Then everyone leaves and withdraws.
const regs = {};
for (const [k, s] of Object.entries({ a, b, c })) regs[k] = (await s.sb.rpc("register_event", { p_event_id: ev.drone })).data;
assert.equal(await code(a.sb.rpc("create_team", { p_event_id: ev.drone, p_name: "x" })), "PT400", "team name length");
const team = (await a.sb.rpc("create_team", { p_event_id: ev.drone, p_name: "Rotor Kids" })).data;
assert.ok(team);
mine = (await a.sb.rpc("my_registrations")).data.find((r) => r.eventId === ev.drone);
const invite = mine.teamMember.team.inviteCode;
assert.match(invite, /^[2-9A-HJ-NP-Z]{6}$/);

const open = (await c.sb.rpc("open_teams", { p_event_id: ev.drone })).data;
const listed = open.find((t) => t.id === team);
assert.equal(listed.leaderName, "Test Student");
assert.equal(listed.inviteCode, undefined, "open teams never show the invite code");

assert.equal((await b.sb.rpc("join_team", { p_invite_code: invite.toLowerCase() })).data, team, "join by code, any case");
assert.equal((await c.sb.rpc("request_join", { p_team_id: team })).error, null);
assert.equal(await code(b.sb.rpc("accept_join", { p_team_id: team, p_registration_id: regs.c })), "PT403", "only the leader accepts");
assert.equal(await code(b.sb.rpc("remove_member", { p_team_id: team, p_registration_id: regs.a })), "PT403", "only the leader removes");
assert.equal(await code(c.sb.rpc("new_invite_code", { p_team_id: team })), "PT404", "outsiders can't touch the team");
mine = (await a.sb.rpc("my_registrations")).data.find((r) => r.eventId === ev.drone);
assert.equal(mine.teamMember.team.joinRequests.length, 1, "leader sees the request");
assert.equal((await a.sb.rpc("accept_join", { p_team_id: team, p_registration_id: regs.c })).error, null);
mine = (await c.sb.rpc("my_registrations")).data.find((r) => r.eventId === ev.drone);
assert.equal(mine.teamMember.team.members.length, 3, "team of 3");
assert.deepEqual(Object.keys(mine.teamMember.team.members[0].registration.student).sort(), ["avantraId", "user"], "teammates see name + ID only");
assert.equal(await code(c.sb.rpc("withdraw_registration", { p_registration_id: regs.c })), "PT409", "leave the team first");

assert.equal((await a.sb.rpc("new_invite_code", { p_team_id: team })).error, null);
assert.equal(await code(a.sb.rpc("join_team", { p_invite_code: invite })), "PT404", "old code stops working");
assert.equal((await a.sb.rpc("leave_team", { p_team_id: team })).error, null);
mine = (await b.sb.rpc("my_registrations")).data.find((r) => r.eventId === ev.drone);
assert.equal(mine.teamMember.isLeader, true, "longest-standing member leads after the leader leaves");
assert.equal((await b.sb.rpc("remove_member", { p_team_id: team, p_registration_id: regs.c })).error, null);
assert.equal((await b.sb.rpc("leave_team", { p_team_id: team })).error, null, "last one out deletes the team");
for (const [k, s] of Object.entries({ a, b, c })) assert.equal((await s.sb.rpc("withdraw_registration", { p_registration_id: regs[k] })).error, null);

// ---- exhibition fee by UPI ----
assert.equal((await a.sb.rpc("submit_upi_payment", { p_utr: "12345" })).error?.hint, "utr", "UTR is 12 digits");
let waiting = (await a.sb.from("Payment").select("utr").eq("status", "CREATED")).data[0];
if (!waiting) {
  const sent = await a.sb.rpc("submit_upi_payment", { p_utr: String(Date.now()).slice(-12).padStart(12, "4") });
  assert.equal(sent.error, null);
  assert.equal(sent.data.status, "CREATED", "waits for the school's check");
  waiting = sent.data;
}
assert.equal(await code(a.sb.rpc("submit_upi_payment", { p_utr: "999999999999" })), "PT409", "one payment waiting at a time");
assert.equal((await b.sb.rpc("submit_upi_payment", { p_utr: waiting.utr })).error?.hint, "utr", "a UTR pays once");
assert.equal((await a.sb.from("Student").select("feePaidAt")).data[0].feePaidAt, null, "sending a UTR doesn't pay the fee");

// ---- Engagement Wall: set E2E_WALL=1 after adding fresh chits TEST22 (typed, answer "1,000") and TEST33 (choice Mars/Venus,
// answer Mars) and wall.open = true. Delete them after: the run leaves solves behind. ----
if (process.env.E2E_WALL) {
  assert.equal(await code(anon.rpc("wall_challenge", { p_code: "TEST22" })), "42501", "logged out can't open chits");
  const chit = (await b.sb.rpc("wall_challenge", { p_code: "test22" })).data;
  assert.equal(chit.question.startsWith("E2E typed"), true);
  assert.equal(chit.answers, undefined, "answers never reach students");
  assert.equal(await code(b.sb.rpc("wall_challenge", { p_code: "ZZZZZZ" })), "PT404");
  assert.ok(!(await b.sb.from("WallChallenge").select("answers")).data?.length, "answers not readable directly");

  const wrong = (await b.sb.rpc("wall_answer", { p_code: "TEST22", p_answer: "100" })).data;
  assert.deepEqual([wrong.correct, wrong.attemptsLeft], [false, 2], "typed: 3 tries");
  const right = (await b.sb.rpc("wall_answer", { p_code: "TEST22", p_answer: " 1000. " })).data;
  assert.deepEqual([right.correct, right.pointsEarned, right.status, right.me.points], [true, 20, "SOLVED", 20]);
  assert.equal(await code(b.sb.rpc("wall_answer", { p_code: "TEST22", p_answer: "1000" })), "PT409", "points once");
  const miss = (await c.sb.rpc("wall_answer", { p_code: "TEST33", p_answer: "Venus" })).data;
  assert.deepEqual([miss.correct, miss.status], [false, "LOCKED"], "choice: 1 try");

  const me = (await b.sb.rpc("wall_me")).data;
  assert.deepEqual([me.open, me.points, me.rank, me.solves.length], [true, 20, 1, 1]);
  const board = (await anon.rpc("wall_leaderboard")).data;
  assert.equal(board.players[0].name, "Test 2.", "public board shortens names (Test Student 2)");
  assert.equal(board.players[0].avantraId, undefined, "no IDs on the public board");
  assert.equal(board.schools[0].name, "SSRVM IEMS");
}

// ---- admin desk: students and logged-out visitors get nothing ----
{
  const calls = [
    ["admin_stats"], ["admin_referrals"], ["admin_upi_waiting"], ["admin_staff"], ["admin_wall"],
    ["admin_mark_paid", { p_avantra_id: "AV26-AAAAA" }],
    ["admin_set_registration_open", { p_event_id: ev.drone, p_open: false }],
    ["admin_event_leaderboard", { p_event_id: ev.drone }],
    ["admin_issue_certificates", { p_event_id: ev.drone }],
    ["admin_set_disabled", { p_user_id: b.uid, p_disabled: true }],
    ["admin_wall_state", { p_open: true }],
    ["admin_export", { p_kind: "students" }], ["admin_export", { p_kind: "upi" }],
    ["admin_upi_decide", { p_decisions: [] }], ["admin_wall_add", { p_challenges: [] }], ["admin_wall_set_answers", { p_challenge_id: "x", p_answers: ["1"] }],
  ];
  for (const [fn, args] of calls) {
    assert.equal(await code(b.sb.rpc(fn, args)), "PT403", `student can't call ${fn}`);
    assert.ok((await anon.rpc(fn, args)).error, `anon can't call ${fn}`);
  }
}

console.log("access e2e: all checks passed");
