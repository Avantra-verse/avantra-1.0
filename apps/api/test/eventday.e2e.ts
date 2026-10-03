// End-to-end event day: volunteer check-in scans, judge scoring, leaderboard.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { admin, call, startApi, student } from './helpers.ts';

startApi(4102);
const prisma = new PrismaClient();
after(() => prisma.$disconnect());

// Payment is covered in payments.e2e.ts; here we just mark the fee paid.
async function paidStudent(tag: string) {
  const s = await student(tag);
  await prisma.student.update({ where: { avantraId: s.avantraId }, data: { feePaidAt: new Date() } });
  const qrToken = (await call('/profile', undefined, s.cookie)).json.student.qrToken as string;
  return { ...s, qrToken };
}

async function staff(adminCookie: string, role: 'VOLUNTEER' | 'JUDGE', eventId?: string) {
  const email = `e2e-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const created = await call('/admin/staff', { role, name: `Test ${role}`, email, password: 'staff-password', eventId }, adminCookie);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const login = await call('/auth/staff/login', { email, password: 'staff-password' });
  assert.equal(login.status, 200);
  return { id: created.json.id as string, cookie: login.cookie };
}

test('check-in scans: gate, event desk, unpaid, duplicates, offline, manual ID', async () => {
  const { cookie: adminCookie } = await admin();
  const ev = await call('/admin/events', { slug: `e2e-desk-${Date.now()}`, name: 'E2E Desk Event', category: 'TECHNOLOGY', teamMin: 1, teamMax: 1 }, adminCookie);
  const [a, b] = [await paidStudent('ga'), await paidStudent('gb')];
  const unpaid = await student('gunpaid');
  const unpaidQr = (await call('/profile', undefined, unpaid.cookie)).json.student.qrToken;
  await call('/registrations', { eventId: ev.json.id }, a.cookie);
  const vol = await staff(adminCookie, 'VOLUNTEER');

  assert.equal((await call('/staff/checkin', { qrToken: a.qrToken }, a.cookie)).status, 403, 'students cannot scan');
  const first = await call('/staff/checkin', { qrToken: a.qrToken }, vol.cookie);
  assert.equal(first.status, 200);
  assert.deepEqual([first.json.student.avantraId, first.json.student.feePaid, first.json.alreadyCheckedIn], [a.avantraId, true, false]);
  assert.equal((await call('/staff/checkin', { qrToken: a.qrToken }, vol.cookie)).json.alreadyCheckedIn, true, 'second scan same day');

  // Entry is free: unpaid students get in too (the card shows it). Unknown badge: 404. Damaged QR: type the ID.
  const free = await call('/staff/checkin', { qrToken: unpaidQr }, vol.cookie);
  assert.deepEqual([free.status, free.json.student.feePaid], [200, false]);
  assert.equal((await call('/staff/checkin', { qrToken: 'x'.repeat(22) }, vol.cookie)).status, 404);
  assert.equal((await call('/staff/checkin', { avantraId: b.avantraId.toLowerCase() }, vol.cookie)).json.student.avantraId, b.avantraId);
  assert.equal((await call('/staff/checkin', { qrToken: a.qrToken, avantraId: a.avantraId }, vol.cookie)).status, 400, 'one identifier');

  // Event desk: must be registered for that event.
  assert.equal((await call('/staff/checkin', { qrToken: a.qrToken, eventId: ev.json.id }, vol.cookie)).json.alreadyCheckedIn, false);
  assert.equal((await call('/staff/checkin', { qrToken: b.qrToken, eventId: ev.json.id }, vol.cookie)).status, 403);

  // Offline scans sync with their own time; very old or future times are rejected.
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  assert.equal((await call('/staff/checkin', { qrToken: b.qrToken, eventId: undefined, scannedAt: hourAgo }, vol.cookie)).json.alreadyCheckedIn, true, 'b was scanned at the gate already');
  assert.equal((await call('/staff/checkin', { qrToken: b.qrToken, scannedAt: new Date(Date.now() - 3 * 86400_000).toISOString() }, vol.cookie)).status, 400);
  assert.equal((await call('/staff/checkin', { qrToken: b.qrToken, scannedAt: new Date(Date.now() + 3600_000).toISOString() }, vol.cookie)).status, 400);
  assert.equal(await prisma.checkIn.count({ where: { student: { avantraId: { in: [a.avantraId, b.avantraId] } } } }), 3, 'a gate + a desk + b gate');
});

test('judging: scan to team, score per criterion, re-score, team locks, leaderboard', async () => {
  const { cookie: adminCookie } = await admin();
  const ev = await call('/admin/events', { slug: `e2e-judge-${Date.now()}`, name: 'E2E Robotics', category: 'TECHNOLOGY', teamMin: 1, teamMax: 3 }, adminCookie);
  const eventId = ev.json.id;
  const [a, b, c] = [await paidStudent('ja'), await paidStudent('jb'), await paidStudent('jc')];
  for (const s of [a, b, c]) await call('/registrations', { eventId }, s.cookie);
  const t1 = await call('/teams', { eventId, name: 'Alpha' }, a.cookie);
  await call('/teams/join', { inviteCode: t1.json.inviteCode }, b.cookie);
  const t2 = await call('/teams', { eventId, name: 'Beta' }, c.cookie);

  assert.equal((await call('/admin/staff', { role: 'JUDGE', name: 'No Event', email: `e2e-noevent-${Date.now()}@example.com`, password: 'staff-password' }, adminCookie)).status, 400, 'judges need an event');
  const [j1, j2] = [await staff(adminCookie, 'JUDGE', eventId), await staff(adminCookie, 'JUDGE', eventId)];
  const vol = await staff(adminCookie, 'VOLUNTEER');
  assert.equal((await call('/staff/judge/teams', undefined, vol.cookie)).status, 403, 'volunteers do not judge');

  const queue = await call('/staff/judge/teams', undefined, j1.cookie);
  assert.deepEqual(queue.json.teams.map((t: { name: string; scored: boolean }) => [t.name, t.scored]), [['Alpha', false], ['Beta', false]]);

  // Scan any member → their team. Default criteria, 0–10 each.
  const looked = await call('/staff/judge/lookup', { qrToken: b.qrToken }, j1.cookie);
  assert.equal(looked.json.name, 'Alpha');
  assert.deepEqual(looked.json.criteria, ['Innovation', 'Scientific understanding', 'Presentation', 'Practical impact']);
  assert.deepEqual(looked.json.myScores, {});

  const score = (cookie: string, teamId: string, pts: number[]) =>
    call('/staff/judge/scores', { teamId, scores: looked.json.criteria.map((criterion: string, i: number) => ({ criterion, points: pts[i] })) }, cookie);
  assert.equal((await call('/staff/judge/scores', { teamId: t1.json.id, scores: [{ criterion: 'Vibes', points: 5 }] }, j1.cookie)).status, 400);
  assert.equal((await call('/staff/judge/scores', { teamId: t1.json.id, scores: [{ criterion: 'Innovation', points: 11 }] }, j1.cookie)).status, 400);
  assert.equal((await score(j1.cookie, t1.json.id, [8, 7, 9, 6])).json.myScores.Innovation, 8);
  assert.equal((await call('/staff/judge/scores', { teamId: t1.json.id, scores: [{ criterion: 'Innovation', points: 10 }] }, j1.cookie)).json.myScores.Innovation, 10, 'judge corrects own score');
  await score(j2.cookie, t1.json.id, [6, 6, 6, 6]); // j1 total 32, j2 total 24 → 28
  await score(j1.cookie, t2.json.id, [9, 9, 9, 9]); // only j1 → 36
  assert.equal((await call('/staff/judge/teams', undefined, j1.cookie)).json.teams.every((t: { scored: boolean }) => t.scored), true);

  // Judged team is locked.
  assert.equal((await call(`/teams/${t1.json.id}/leave`, {}, b.cookie)).status, 409);

  // Leaderboard: average of judges' totals. Admin only.
  assert.equal((await call(`/admin/events/${eventId}/leaderboard`, undefined, j1.cookie)).status, 403);
  const board = (await call(`/admin/events/${eventId}/leaderboard`, undefined, adminCookie)).json;
  assert.deepEqual(board.teams.map((t: { name: string; score: number; judges: number }) => [t.name, t.score, t.judges]), [['Beta', 36, 1], ['Alpha', 28, 2]]);
  assert.equal(board.event.maxScore, 40);

  // Judge moved to another event can't see this one's teams.
  const other = await call('/admin/events', { slug: `e2e-other-${Date.now()}`, name: 'E2E Other', category: 'TECHNOLOGY', teamMin: 1, teamMax: 1 }, adminCookie);
  assert.equal((await call(`/admin/staff/${j2.id}/assign`, { eventId: other.json.id }, adminCookie)).json.assignedEvent.name, 'E2E Other');
  assert.equal((await call('/staff/judge/lookup', { qrToken: a.qrToken }, j2.cookie)).status, 404);
  assert.equal((await call(`/staff/judge/teams/${t1.json.id}`, undefined, j2.cookie)).status, 404);
});
