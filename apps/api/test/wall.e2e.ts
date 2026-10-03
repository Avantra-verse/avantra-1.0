// End-to-end ARITHI Engagement Wall: chits, answers, 3 tries, re-grading, lost chits, leaderboards, exports.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { admin, call, signUp, startApi, student } from './helpers.ts';

startApi(4104);
const prisma = new PrismaClient();
after(() => prisma.$disconnect());

test('wall: play, tries, re-grade, lost chit, ranks, school board, admin controls', async () => {
  const { cookie: adminCookie } = await admin();
  const n = 1000 + Math.floor(Math.random() * 8000);
  const typed = { number: n, category: 'Mathematics', difficulty: 3, question: 'What is 25 × 40?', answers: ['1000'] };
  const mcq = { number: n + 1, category: 'Science', difficulty: 8, points: 100, question: 'Which planet is red?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], answers: ['Mars'] };

  // Admin adds a sheet. Bad multiple choice and reused numbers are refused; points default to 10 × difficulty.
  assert.equal((await call('/admin/wall/challenges', [{ ...mcq, answers: ['Pluto'] }], adminCookie)).status, 400);
  const created = await call('/admin/wall/challenges', [typed, mcq], adminCookie);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const [T, M] = created.json as { id: string; code: string; points: number }[];
  assert.equal(T.points, 30);
  assert.match(T.code, /^[2-9A-HJ-NP-Z]{6}$/);
  assert.equal((await call('/admin/wall/challenges', [typed], adminCookie)).status, 409);

  // Any student with a profile plays; no fee needed. Closed wall: nothing opens.
  const [a, b, c, d] = [await student('wa'), await student('wb'), await student('wc'), await student('wd')];
  await call('/admin/wall/state', { open: false }, adminCookie, { method: 'PUT' });
  assert.equal((await call(`/wall/challenges/${T.code}`, undefined, a.cookie)).status, 403);
  assert.equal((await call('/admin/wall/state', { open: true }, a.cookie, { method: 'PUT' })).status, 403, 'admin only');
  assert.equal((await call('/admin/wall/state', { open: true }, adminCookie, { method: 'PUT' })).json.open, true);
  assert.equal((await call(`/wall/challenges/${T.code}`, undefined, (await signUp('STUDENT', 'wnoprofile')).cookie)).status, 403);

  // Opening a chit: codes are case-insensitive, answers never leave the server.
  assert.equal((await call('/wall/challenges/ZZZZZZ', undefined, a.cookie)).status, 404);
  const seen = await call(`/wall/challenges/${T.code.toLowerCase()}`, undefined, a.cookie);
  assert.deepEqual([seen.json.points, seen.json.status, seen.json.attemptsLeft, seen.json.answers], [30, 'OPEN', 3, undefined]);

  // Wrong, wrong, right ("1,000" counts as 1000). Points once only.
  const answer = (s: { cookie: string }, code: string, ans: string) => call(`/wall/challenges/${code}/answer`, { answer: ans }, s.cookie);
  assert.deepEqual([(await answer(a, T.code, '900')).json.attemptsLeft, (await answer(a, T.code, '999')).json.attemptsLeft], [2, 1]);
  const right = (await answer(a, T.code, ' 1,000 ')).json;
  assert.deepEqual([right.correct, right.pointsEarned, right.status, right.me.points], [true, 30, 'SOLVED', 30]);
  assert.equal((await answer(a, T.code, '1000')).status, 409, 'no double points');
  assert.equal((await answer(a, M.code, 'mars')).json.me.points, 130);

  // Multiple choice: one try, so guessing doesn't pay. Admin can reset a disputed challenge for one student.
  assert.equal((await call(`/wall/challenges/${M.code}`, undefined, b.cookie)).json.attemptsLeft, 1);
  assert.deepEqual([(await answer(b, M.code, 'Venus')).json.status], ['LOCKED']);
  assert.equal((await answer(b, M.code, 'Mars')).status, 409);
  assert.equal((await call(`/admin/wall/challenges/${M.id}/students/${b.avantraId}`, undefined, adminCookie, { method: 'DELETE' })).status, 204);
  assert.equal((await call(`/wall/challenges/${M.code}`, undefined, b.cookie)).json.attemptsLeft, 1);

  // c types an answer the organisers didn't foresee; admin accepts it and c gets the points for that earlier try.
  assert.equal((await answer(c, T.code, 'one thousand')).json.correct, false);
  await answer(d, T.code, '1000'); // d solves after c's try
  const patched = await call(`/admin/wall/challenges/${T.id}`, { answers: ['1000', 'One Thousand'] }, adminCookie, { method: 'PATCH' });
  assert.equal(patched.json.regraded, 1);
  const [meA, meC, meD] = await Promise.all([a, c, d].map(async (s) => (await call('/wall/me', undefined, s.cookie)).json));
  assert.deepEqual([meC.points, meC.solved, meD.points], [30, 1, 30]);
  assert.ok(meA.rank < meC.rank && meC.rank < meD.rank, 'more points first; equal points: whoever got there first');
  assert.equal(meA.solves.length, 2);

  // Lost chit: new code, old one dead, points stay. Withdrawn chit: 410.
  const fresh = (await call(`/admin/wall/challenges/${T.id}/new-code`, {}, adminCookie)).json.code;
  assert.equal((await call(`/wall/challenges/${T.code}`, undefined, b.cookie)).status, 404);
  assert.equal((await call(`/wall/challenges/${fresh}`, undefined, b.cookie)).json.status, 'OPEN');
  assert.equal((await call('/wall/me', undefined, a.cookie)).json.points, 130);
  await call(`/admin/wall/challenges/${M.id}`, { active: false }, adminCookie, { method: 'PATCH' });
  assert.equal((await call(`/wall/challenges/${M.code}`, undefined, b.cookie)).status, 410);

  // School board: linked students add up; "Others" students rank alone.
  const coord = await signUp('SCHOOL_COORDINATOR', 'wcoord');
  const school = await call('/profile/school', { schoolName: `Wall School ${n}`, city: 'Rourkela', address: 'Sector 20 road', phone: '9876544444' }, coord.cookie);
  await prisma.school.update({ where: { id: school.json.id }, data: { status: 'APPROVED' } });
  await prisma.student.updateMany({ where: { avantraId: { in: [a.avantraId, c.avantraId] } }, data: { schoolId: school.json.id } });
  await call(`/admin/wall/challenges/${T.id}`, { points: 31 }, adminCookie, { method: 'PATCH' }); // clears the 5 s cache
  const board = (await call('/wall/leaderboard')).json;
  const row = board.schools.find((s: { name: string }) => s.name === `Wall School ${n}`);
  assert.deepEqual([row.points, row.solved, row.players], [131 + 31, 3, 2]);
  assert.equal((await call('/wall/me', undefined, a.cookie)).json.school.name, `Wall School ${n}`);
  assert.equal((await call('/wall/me', undefined, d.cookie)).json.school, null);
  assert.ok(board.players.every((p: object) => !('avantraId' in p)), 'public board has no IDs');
  assert.ok(board.players.some((p: { name: string }) => p.name === 'Test W.'), 'names shortened');

  // Exports: chits to print (no answers), standings with IDs for prizes.
  const chits = (await call('/admin/export/wall-chits.csv', undefined, adminCookie)).text;
  assert.ok(chits.includes(fresh) && !chits.includes('One Thousand') && !chits.includes(M.code), 'active chits only, no answers');
  assert.ok((await call('/admin/export/wall.csv', undefined, adminCookie)).text.includes(a.avantraId));
  assert.equal((await call('/admin/export/wall.csv', undefined, a.cookie)).status, 403);

  await call('/admin/wall/state', { open: false }, adminCookie, { method: 'PUT' });
  assert.equal((await call('/wall/leaderboard')).json.open, false);
});

test('wall freeze: public board and ranks stop, own points stay live, unfreeze reveals', async () => {
  const { cookie: adminCookie } = await admin();
  const n = 1000 + Math.floor(Math.random() * 8000);
  const [one, two] = (await call('/admin/wall/challenges', [1, 2].map((k) => ({ number: n + k, category: 'Puzzle', difficulty: 1, points: 10, question: `Q${k}`, answers: ['yes'] })), adminCookie)).json;
  await call('/admin/wall/state', { open: true, frozen: false }, adminCookie, { method: 'PUT' });

  // A fresh school with one player, so its row is easy to find on the public board.
  const s = await student('wfz');
  const coord = await signUp('SCHOOL_COORDINATOR', 'wfzcoord');
  const school = await call('/profile/school', { schoolName: `Freeze School ${n}`, city: 'Rourkela', address: 'Sector 20 road', phone: '9876544444' }, coord.cookie);
  await prisma.school.update({ where: { id: school.json.id }, data: { status: 'APPROVED' } });
  await prisma.student.update({ where: { avantraId: s.avantraId }, data: { schoolId: school.json.id } });
  const row = async () => (await call('/wall/leaderboard')).json.schools.find((x: { name: string }) => x.name === `Freeze School ${n}`);

  await call(`/wall/challenges/${one.code}/answer`, { answer: 'yes' }, s.cookie);
  assert.equal((await row()).points, 10);

  assert.equal((await call('/admin/wall/state', { frozen: true }, s.cookie, { method: 'PUT' })).status, 403, 'admin only');
  const frozen = (await call('/admin/wall/state', { frozen: true }, adminCookie, { method: 'PUT' })).json.frozenAt;
  assert.ok(frozen);
  assert.equal((await call('/admin/wall/state', { frozen: true }, adminCookie, { method: 'PUT' })).json.frozenAt, frozen, 'freezing again keeps the time');

  // Play goes on; the student sees their own points, but the board and ranks stay at the freeze.
  const after = (await call(`/wall/challenges/${two.code}/answer`, { answer: 'yes' }, s.cookie)).json;
  assert.deepEqual([after.correct, after.me.points, after.me.school.points, after.me.frozenAt], [true, 20, 10, frozen]);
  const board = (await call('/wall/leaderboard')).json;
  assert.equal(board.frozenAt, frozen);
  assert.equal((await row()).points, 10);
  assert.match((await call('/admin/export/wall.csv', undefined, adminCookie)).text, new RegExp(`${s.avantraId},Test wfz,9,,Freeze School ${n},20,2`), 'admin export is live');

  // Ceremony: unfreeze reveals the final standings.
  assert.equal((await call('/admin/wall/state', { frozen: false }, adminCookie, { method: 'PUT' })).json.frozenAt, null);
  assert.equal((await row()).points, 20);
  assert.equal((await call('/admin/wall/state', {}, adminCookie, { method: 'PUT' })).status, 400);
  await call('/admin/wall/state', { open: false }, adminCookie, { method: 'PUT' });
});

test('wall admin: spreadsheet template + upload, print-ready chits with QR', async () => {
  const { cookie: adminCookie } = await admin();
  const template = await call('/admin/wall/template.csv', undefined, adminCookie);
  assert.match(template.headers.get('content-disposition')!, /avantra-wall-template\.csv/);
  assert.ok(template.text.includes('option_a') && template.text.includes('Red Planet'));

  // Bad rows: nothing added, every problem listed with its spreadsheet row.
  const n = 1000 + Math.floor(Math.random() * 8000);
  const header = 'number,category,difficulty,points,question,option_a,option_b,option_c,answers\n';
  const bad = await call('/admin/wall/import', { csv: header + `${n},Maths,3,,Q,,,,1\n${n + 1},Science,2,,Q2,Yes,No,,C\n` }, adminCookie);
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.json.errors.map((e: string) => e.slice(0, 6)), ['Row 2:', 'Row 3:']);
  assert.equal((await call('/admin/wall/import', { csv: 'x' }, (await student('wimp')).cookie)).status, 403);

  // Excel's BOM, lowercase category, option letter, default points (10 × difficulty), maths symbols.
  const rows = `${n},Mathematics,4,,"√144 + π ≈ ? (2 d.p.)",,,,15.14\n${n + 1},science,6,75,Which gas do plants absorb?,Oxygen,Carbon dioxide,Nitrogen,B\n`;
  const ok = await call('/admin/wall/import', { csv: '﻿' + header + rows }, adminCookie);
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  assert.deepEqual(ok.json.map((c: { points: number; answers: string[] }) => [c.points, c.answers]), [[40, ['15.14']], [75, ['Carbon dioxide']]]);

  const pdf = await call(`/admin/wall/chits.pdf?numbers=${n},${n + 1}`, undefined, adminCookie);
  assert.deepEqual([pdf.status, pdf.headers.get('content-type')], [200, 'application/pdf']);
  assert.ok(pdf.text.startsWith('%PDF-'));
  assert.equal((await call('/admin/wall/chits.pdf?numbers=99999', undefined, adminCookie)).status, 404);
});
