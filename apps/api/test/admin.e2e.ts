// End-to-end admin desk: cash fee, walk-ins, dashboard numbers, CSV exports, ranks, certificates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admin, call, codeFor, logs, sleep, startApi, student } from './helpers.ts';

startApi(4103);

test('cash fee, walk-in, stats, CSV exports', async () => {
  const { cookie: adminCookie, email: adminEmail } = await admin();
  const before = (await call('/admin/stats', undefined, adminCookie)).json;
  const a = await student('cash');

  // Cash for an online sign-up: once only, recorded against the admin, same confirmation email.
  assert.equal((await call(`/admin/students/${a.avantraId}/mark-paid`, { note: 'RCPT-001' }, a.cookie)).status, 403, 'admin only');
  const paid = await call(`/admin/students/${a.avantraId.toLowerCase()}/mark-paid`, { note: 'RCPT-001' }, adminCookie);
  assert.deepEqual([paid.status, paid.json.feePaid], [200, true]);
  assert.equal((await call(`/admin/students/${a.avantraId}/mark-paid`, {}, adminCookie)).status, 409, 'no double cash');
  assert.ok((await call('/profile', undefined, a.cookie)).json.student.feePaidAt);
  assert.equal((await call('/admin/students/AV26-ZZZZZ/mark-paid', {}, adminCookie)).status, 404);

  // Walk-in: account + profile + cash in one step, then they set a password via "Forgot password".
  const walkEmail = `e2e-walkin-${Date.now()}@example.com`;
  const walkIn = { name: '=SUM(1+1)', email: walkEmail, phone: '9876522222', grade: 8, otherSchoolName: 'Walk-in School', guardianPhone: '9876533333', guardianConsent: true, note: 'RCPT-002' };
  const w = await call('/admin/walk-in', walkIn, adminCookie);
  assert.equal(w.status, 201, JSON.stringify(w.json));
  assert.match(w.json.avantraId, /^AV26-/);
  assert.equal((await call('/admin/walk-in', walkIn, adminCookie)).status, 409, 'email taken');
  await sleep(300);
  assert.ok(logs().includes(`to ${walkEmail} |`) && logs().includes('Forgot password'));
  assert.equal((await call('/auth/password/forgot', { email: walkEmail })).status, 202);
  assert.equal((await call('/auth/password/reset', { email: walkEmail, code: await codeFor(walkEmail), password: 'walk-in-password' })).status, 200);
  assert.equal((await call('/auth/login', { role: 'STUDENT', email: walkEmail, password: 'walk-in-password' })).status, 200);

  // Dashboard numbers move by exactly what we did.
  const after = (await call('/admin/stats', undefined, adminCookie)).json;
  assert.equal(after.students.paid - before.students.paid, 2);
  assert.equal(after.fees.cashCount - before.fees.cashCount, 2);
  assert.equal(after.fees.cashPaise - before.fees.cashPaise, 2 * 19900);
  assert.equal((await call('/admin/stats', undefined, a.cookie)).status, 403);

  // Exports: CSV, Excel-safe, formula names neutralised, cash traced to the admin.
  const students = await call('/admin/export/students.csv', undefined, adminCookie);
  assert.match(students.headers.get('content-type')!, /text\/csv/);
  assert.match(students.headers.get('content-disposition')!, /avantra-students\.csv/);
  assert.ok(students.text.includes(a.avantraId));
  assert.ok(students.text.includes(`"'=SUM(1+1)"`), 'formula injection neutralised');
  const payments = (await call('/admin/export/payments.csv', undefined, adminCookie)).text;
  const cashRow = payments.split('\r\n').find((l) => l.includes(a.avantraId))!;
  assert.ok(cashRow.includes('OFFLINE') && cashRow.includes(adminEmail) && cashRow.includes('RCPT-001'));
  assert.equal((await call('/admin/export/students.csv', undefined, a.cookie)).status, 403, 'minors data: admin only');
});

test('ranks and certificates: only attendees, idempotent issue, public verify + PDF', async () => {
  const { cookie: adminCookie } = await admin();
  const ev = await call('/admin/events', { slug: `e2e-cert-${Date.now()}`, name: 'E2E Robotics Cert', category: 'TECHNOLOGY', teamMin: 1, teamMax: 2 }, adminCookie);
  const eventId = ev.json.id;
  const [a, b, absent] = [await student('certa'), await student('certb'), await student('certabsent')];
  for (const s of [a, b, absent]) {
    await call(`/admin/students/${s.avantraId}/mark-paid`, {}, adminCookie);
    assert.equal((await call('/registrations', { eventId }, s.cookie)).status, 201);
  }
  const team = await call('/teams', { eventId, name: 'Cert Team' }, a.cookie);
  await call('/teams/join', { inviteCode: team.json.inviteCode }, b.cookie);
  await call('/teams', { eventId, name: 'Absent Team' }, absent.cookie);

  // a and b check in at the gate; "absent" never shows up.
  for (const s of [a, b]) assert.equal((await call('/staff/checkin', { avantraId: s.avantraId }, adminCookie)).status, 200);
  assert.equal((await call(`/admin/teams/${team.json.id}/rank`, { rank: 1 }, adminCookie)).json.rank, 1);
  assert.equal((await call(`/admin/teams/${team.json.id}/rank`, { rank: 4 }, adminCookie)).status, 400);

  const issued = await call(`/admin/events/${eventId}/certificates`, {}, adminCookie);
  assert.deepEqual([issued.json.issuedNow, issued.json.issued, issued.json.notCheckedIn], [2, 2, 1]);
  assert.equal((await call(`/admin/events/${eventId}/certificates`, {}, adminCookie)).json.issuedNow, 0, 're-run keeps existing codes');

  const mine = (await call('/registrations/mine', undefined, a.cookie)).json.find((r: { eventId: string }) => r.eventId === eventId);
  assert.match(mine.certificateCode, /^[2-9A-HJ-NP-Z]{10}$/);
  const absentMine = (await call('/registrations/mine', undefined, absent.cookie)).json.find((r: { eventId: string }) => r.eventId === eventId);
  assert.equal(absentMine.certificateCode, null);

  // Public: anyone with the code can verify and download. Codes are case-insensitive.
  const verify = await call(`/certificates/${mine.certificateCode.toLowerCase()}`);
  assert.deepEqual([verify.json.valid, verify.json.event, verify.json.rank], [true, 'E2E Robotics Cert', 1]);
  assert.ok(verify.json.verifyUrl.endsWith(`/verify/${mine.certificateCode}`));
  const pdf = await call(`/certificates/${mine.certificateCode}/pdf`);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.ok(pdf.text.startsWith('%PDF-'));
  assert.equal((await call('/certificates/ZZZZZZZZZZ')).status, 404);
});
