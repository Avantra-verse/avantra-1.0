// Every role's happy path against a live project, start to finish: admin, volunteer, judge and three students.
// Usage (from apps/web, with .env.local loaded):
//   E2E_INBOX=you@gmail.com SUPABASE_URL=… SUPABASE_KEY=sb_publishable_… SUPABASE_SECRET_KEY=sb_secret_… node scripts/flows.e2e.mjs
// Makes throwaway accounts at E2E_INBOX plus-addresses (you+e2e-…@), so the fee, UPI, walk-in and contact emails
// really go out (about 6 per run). Deletes every account, team, scan, score and chit it made, even when a check fails.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SECRET_KEY, E2E_INBOX } = process.env;
assert.ok(SUPABASE_URL && SUPABASE_KEY && SUPABASE_SECRET_KEY && E2E_INBOX, "set SUPABASE_URL, SUPABASE_KEY, SUPABASE_SECRET_KEY, E2E_INBOX");
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, opts);
const anon = createClient(SUPABASE_URL, SUPABASE_KEY, opts);
const run = Math.random().toString(36).slice(2, 7);
const [box, domain] = E2E_INBOX.split("@");
const mail = (tag) => `${box}+e2e-${tag}-${run}@${domain}`;
const password = `E2e-${crypto.randomUUID()}`;
const made = { users: [], teams: [], chits: [] };
const step = (s) => console.log(`  ✓ ${s}`);

// The result of a call that must work.
const ok = async (call, what) => {
  const { data, error } = await call;
  assert.equal(error, null, `${what}: ${error?.message}`);
  return data;
};
// The error code of a call that must fail.
const fails = async (call) => {
  const { error } = await call;
  assert.ok(error, "expected an error");
  return error.code;
};
// An Auth account (role only via app_metadata, as the admin page does), logged in with the publishable key.
async function account(tag, name, role) {
  const { data, error } = await service.auth.admin.createUser({
    email: mail(tag), password, email_confirm: true, user_metadata: { name }, ...(role && { app_metadata: { role } }),
  });
  assert.equal(error, null, `create ${tag}: ${error?.message}`);
  made.users.push(data.user.id);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, opts);
  await ok(sb.auth.signInWithPassword({ email: mail(tag), password }), `log in ${tag}`);
  return { sb, uid: data.user.id };
}
const utr = () => String(Math.floor(1e11 + Math.random() * 9e11));
const profile = (phone) => ({ phone, grade: 9, schoolName: "E2E Flow School", guardianConsent: true, referralCode: `E2${run.toUpperCase().slice(0, 4)}` });

const wallBefore = (await service.from("Setting").select("value").eq("key", "wall.open").maybeSingle()).data?.value;
try {
  const events = Object.fromEntries((await ok(anon.rpc("events_list"), "events")).map((e) => [e.slug, e]));
  const ex = events.exhibition;

  console.log("accounts");
  const admin = await account("admin", "E2E Admin", "ADMIN");
  const vol = await account("volunteer", "E2E Volunteer", "VOLUNTEER");
  const judge = await account("judge", "E2E Judge", "JUDGE");
  const exp = new Date(Date.now() + 864e5).toISOString();
  await ok(admin.sb.rpc("admin_staff_setup", { p_user_id: vol.uid, p_event_id: null, p_expires_at: exp }), "volunteer setup");
  await ok(admin.sb.rpc("admin_staff_setup", { p_user_id: judge.uid, p_event_id: events.drone.id, p_expires_at: exp }), "judge setup");
  await ok(admin.sb.rpc("admin_assign_judge", { p_user_id: judge.uid, p_event_id: ex.id }), "judge moved to exhibition");
  const staff = await ok(admin.sb.rpc("admin_staff"), "staff list");
  assert.ok(JSON.stringify(staff).includes(mail("judge")), "judge on the staff list");
  step("admin makes a volunteer and a judge, moves the judge to the exhibition");

  const a = await account("student-a", "E2E Asha", null);
  const b = await account("student-b", "E2E Bilal", null);
  const ida = (await ok(a.sb.rpc("create_student_profile", { profile: profile("9000000001") }), "profile A")).avantraId;
  const idb = (await ok(b.sb.rpc("create_student_profile", { profile: profile("9000000002") }), "profile B")).avantraId;
  step(`students sign up and make profiles (${ida}, ${idb})`);

  console.log("fees");
  assert.equal(await fails(a.sb.rpc("register_event", { p_event_id: ex.id })), "PT403", "exhibition needs the fee");
  const utr1 = utr();
  await ok(a.sb.rpc("submit_upi_payment", { p_utr: utr1 }), "UTR 1");
  let waiting = await ok(admin.sb.rpc("admin_upi_waiting"), "UPI waiting");
  assert.ok(waiting.some((p) => p.utr === utr1), "admin sees the UTR waiting");
  let decided = await ok(admin.sb.rpc("admin_upi_decide", { p_decisions: [{ row: 2, avantraId: ida, utr: utr1, status: "FAILED" }] }), "decide 1");
  assert.equal(decided[0].result, "failed");
  step("UPI: student A sends a UTR, the school marks it Not paid (\"try again\" email)");
  const utr2 = utr();
  await ok(a.sb.rpc("submit_upi_payment", { p_utr: utr2 }), "UTR 2");
  decided = await ok(admin.sb.rpc("admin_upi_decide", { p_decisions: [{ row: 2, avantraId: ida, utr: utr2, status: "PAID" }] }), "decide 2");
  assert.equal(decided[0].result, "paid");
  decided = await ok(admin.sb.rpc("admin_upi_decide", { p_decisions: [{ row: 2, avantraId: ida, utr: utr2, status: "PAID" }] }), "decide again");
  assert.equal(decided[0].result, "already", "uploading the same sheet twice changes nothing");
  assert.ok((await ok(a.sb.from("Student").select("feePaidAt"), "A fee"))[0].feePaidAt, "A's fee is paid");
  step("UPI: A sends a second UTR, the school marks it Paid (fee email); re-upload is ignored");

  await ok(admin.sb.rpc("admin_mark_paid", { p_avantra_id: idb.toLowerCase(), p_note: "e2e cash" }), "cash B");
  assert.equal(await fails(admin.sb.rpc("admin_mark_paid", { p_avantra_id: idb, p_note: null })), "PT409", "can't pay twice");
  step("cash: admin marks B paid at the desk (fee email)");

  const walk = await service.auth.admin.createUser({ email: mail("walk-in"), email_confirm: true, user_metadata: { name: "E2E Chitra" } });
  assert.equal(walk.error, null);
  made.users.push(walk.data.user.id);
  const idc = (await ok(admin.sb.rpc("admin_walk_in", { p_user_id: walk.data.user.id, p_profile: profile("9000000003"), p_note: "e2e walk-in" }), "walk-in")).avantraId;
  await ok(service.auth.admin.updateUserById(walk.data.user.id, { password }), "walk-in sets a password"); // what "Forgot password" does
  const c = { sb: createClient(SUPABASE_URL, SUPABASE_KEY, opts), uid: walk.data.user.id };
  await ok(c.sb.auth.signInWithPassword({ email: mail("walk-in"), password }), "walk-in logs in");
  step(`walk-in: admin registers C at the desk, paid (${idc}, welcome email)`);

  console.log("events and teams");
  await ok(admin.sb.rpc("admin_set_registration_open", { p_event_id: events.drone.id, p_open: false }), "close drone");
  assert.equal(await fails(a.sb.rpc("register_event", { p_event_id: events.drone.id })), "PT400", "closed event refuses entries");
  await ok(admin.sb.rpc("admin_set_registration_open", { p_event_id: events.drone.id, p_open: true }), "reopen drone");
  step("admin closes and reopens an event; closed refuses sign-ups");

  for (const s of [a, b, c]) await ok(s.sb.rpc("register_event", { p_event_id: ex.id }), "register exhibition");
  const team = await ok(a.sb.rpc("create_team", { p_event_id: ex.id, p_name: `E2E Team ${run}`, p_project_title: "Solar Water Purifier", p_topic: "Robotics" }), "team");
  made.teams.push(team);
  const invite = (await ok(a.sb.rpc("my_registrations"), "A regs")).find((r) => r.eventId === ex.id).teamMember.team.inviteCode;
  await ok(b.sb.rpc("join_team", { p_invite_code: invite }), "B joins");
  await ok(c.sb.rpc("request_join", { p_team_id: team }), "C asks");
  const regC = (await ok(c.sb.rpc("my_registrations"), "C regs")).find((r) => r.eventId === ex.id).id;
  await ok(a.sb.rpc("accept_join", { p_team_id: team, p_registration_id: regC }), "A accepts C");
  const members = (await ok(c.sb.rpc("my_registrations"), "C regs")).find((r) => r.eventId === ex.id).teamMember.team.members;
  assert.equal(members.length, 3, "team of 3");
  step("A, B, C register for the exhibition; A makes a team, B joins by code, C asks and A accepts");

  console.log("event day");
  const qrA = (await ok(a.sb.from("Student").select("qrToken"), "A qr"))[0].qrToken;
  let scan = await ok(vol.sb.rpc("staff_checkin", { p_qr_token: qrA, p_avantra_id: null, p_event_id: null, p_scanned_at: null }), "gate scan");
  assert.equal(scan.alreadyCheckedIn, false);
  scan = await ok(vol.sb.rpc("staff_checkin", { p_qr_token: qrA, p_avantra_id: null, p_event_id: null, p_scanned_at: null }), "gate rescan");
  assert.equal(scan.alreadyCheckedIn, true, "second scan says already in");
  await ok(vol.sb.rpc("staff_checkin", { p_qr_token: null, p_avantra_id: idb, p_event_id: ex.id, p_scanned_at: null }), "desk scan by ID");
  assert.ok((await ok(vol.sb.rpc("staff_find_students", { p_q: idc }), "find C")).length >= 1, "volunteer finds C by ID");
  assert.equal((await ok(vol.sb.rpc("staff_my_scans"), "my scans")).total, 2, "rescan isn't counted twice");
  step("volunteer scans A's QR at the gate (rescan = already in), B by ID at the exhibition desk, finds C");

  await ok(admin.sb.rpc("admin_set_disabled", { p_user_id: vol.uid, p_disabled: true }), "disable volunteer");
  assert.equal(await fails(vol.sb.rpc("staff_my_scans")), "PT403", "switched-off volunteer is locked out");
  await ok(admin.sb.rpc("admin_set_disabled", { p_user_id: vol.uid, p_disabled: false }), "enable volunteer");
  step("admin switches the volunteer off (locked out) and on again");

  const jt = await ok(judge.sb.rpc("judge_teams"), "judge teams");
  assert.ok(jt.teams.some((t) => t.id === team), "judge sees the team");
  const qrB = (await ok(b.sb.from("Student").select("qrToken"), "B qr"))[0].qrToken;
  assert.equal((await ok(judge.sb.rpc("judge_lookup", { p_qr_token: qrB, p_avantra_id: null }), "judge scan")).id, team, "judge scans a member, gets the team");
  const pts = [8, 7, 9, 6];
  await ok(judge.sb.rpc("judge_submit_scores", { p_team_id: team, p_scores: ex.judgingCriteria.map((criterion, i) => ({ criterion, points: pts[i] })) }), "scores");
  assert.equal(await fails(judge.sb.rpc("judge_submit_scores", { p_team_id: team, p_scores: [{ criterion: "Innovation", points: 11 }] })), "PT400", "0–10 only");
  step("judge sees the team, scans B's QR to open it, scores 8/7/9/6");

  const board = await ok(admin.sb.rpc("admin_event_leaderboard", { p_event_id: ex.id }), "leaderboard");
  const row = board.teams.find((t) => t.teamId === team);
  assert.deepEqual([Number(row.score), row.judges], [30, 1], "score 30 from 1 judge");
  await ok(admin.sb.rpc("admin_set_rank", { p_team_id: team, p_rank: 1 }), "rank 1");
  const certs = await ok(admin.sb.rpc("admin_issue_certificates", { p_event_id: ex.id }), "certificates");
  assert.ok(certs.issuedNow >= 2, "A and B were scanned in, so both get certificates");
  const certA = (await ok(a.sb.from("Registration").select("certificateCode").eq("eventId", ex.id), "A cert"))[0].certificateCode;
  const certC = (await ok(c.sb.from("Registration").select("certificateCode").eq("eventId", ex.id), "C cert"))[0].certificateCode;
  assert.equal(certC, null, "C never scanned in: no certificate");
  const verify = await ok(anon.rpc("certificate", { p_code: certA.toLowerCase() }), "verify");
  assert.deepEqual([verify.name, verify.rank, verify.event], ["E2E Asha", 1, ex.name]);
  step(`admin sees score 30, ranks the team 1st, issues certificates; anyone can verify ${certA}`);

  console.log("wall");
  const n = 90000 + Math.floor(Math.random() * 9000);
  const chits = await ok(admin.sb.rpc("admin_wall_add", { p_challenges: [
    { number: n, category: "Science", difficulty: 2, question: "E2E: how many legs does a spider have?", answers: ["8", "eight"] },
    { number: n + 1, category: "Space", difficulty: 1, question: "E2E: the red planet?", options: ["Mars", "Venus"], answers: ["Mars"] },
  ] }), "add chits");
  made.chits.push(...chits.map((x) => x.id));
  await ok(admin.sb.rpc("admin_wall_state", { p_open: true, p_frozen: null }), "open wall");
  const q = await ok(b.sb.rpc("wall_challenge", { p_code: chits[0].code.toLowerCase() }), "open chit");
  assert.equal(q.answers, undefined, "answers never reach students");
  assert.equal((await ok(b.sb.rpc("wall_answer", { p_code: chits[0].code, p_answer: " Eight " }), "answer")).correct, true);
  assert.equal((await ok(c.sb.rpc("wall_answer", { p_code: chits[1].code, p_answer: "Venus" }), "wrong")).status, "LOCKED", "choice: one try");
  const me = await ok(b.sb.rpc("wall_me"), "wall me");
  assert.equal(me.points, 20);
  assert.ok((await ok(anon.rpc("wall_leaderboard"), "public board")).players.some((p) => p.name.startsWith("E2E")), "B on the public board");
  step("admin uploads 2 chits and opens the Wall; B solves one (20 pts), C misses a 1-try chit; public board shows B");

  console.log("admin desk");
  const stats = await ok(admin.sb.rpc("admin_stats"), "stats");
  assert.ok(stats.students.paid >= 3 && stats.fees.cashCount >= 2 && stats.fees.onlineCount >= 1);
  const refs = await ok(admin.sb.rpc("admin_referrals"), "referrals");
  assert.ok(JSON.stringify(refs).includes(profile("").referralCode), "referral code counted");
  for (const kind of ["students", "upi"]) await ok(admin.sb.rpc("admin_export", { p_kind: kind, p_event_id: null }), `export ${kind}`);
  await ok(admin.sb.rpc("admin_export", { p_kind: "registrations", p_event_id: ex.id }), "export event");
  step("dashboard stats, referral counts and CSV exports work");

  await ok(anon.rpc("contact_message", { p_name: "E2E Visitor", p_email: mail("contact"), p_message: `E2E contact form test ${run}`, p_school: "E2E Flow School" }), "contact");
  step("contact form sends (email to the admins)");

  console.log("flows e2e: all checks passed");
} finally {
  // Rows that block deleting the accounts (restrict FKs), then the accounts themselves (the rest cascades).
  if (made.teams.length) await service.from("Score").delete().in("teamId", made.teams);
  if (made.users.length) {
    await service.from("CheckIn").delete().in("studentId", made.users);
    await service.from("CheckIn").delete().in("scannedById", made.users);
    await service.from("Registration").delete().in("studentId", made.users);
  }
  if (made.teams.length) await service.from("Team").delete().in("id", made.teams);
  if (made.chits.length) await service.from("WallChallenge").delete().in("id", made.chits);
  if (wallBefore === undefined) await service.from("Setting").delete().eq("key", "wall.open");
  else await service.from("Setting").update({ value: wallBefore }).eq("key", "wall.open");
  for (const id of made.users) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) console.error(`cleanup: couldn't delete ${id}: ${error.message}`);
  }
  console.log(`cleanup: removed ${made.users.length} accounts, ${made.teams.length} team, ${made.chits.length} chits`);
}
