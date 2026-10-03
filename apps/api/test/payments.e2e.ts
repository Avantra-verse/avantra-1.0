// End-to-end AVANTRA fee (Razorpay), event registration and team flows, against a fake Razorpay server.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { admin, call, logs, signUp, sleep, startApi, student } from './helpers.ts';

const RZP = { RAZORPAY_KEY_ID: 'rzp_test_e2e', RAZORPAY_KEY_SECRET: 'key-secret-e2e', RAZORPAY_WEBHOOK_SECRET: 'webhook-secret-e2e' };
const orders: { amount: number; auth: string }[] = [];
let fake: Server;

before(async () => {
  // Stands in for POST https://api.razorpay.com/v1/orders.
  fake = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      const { amount } = JSON.parse(body);
      orders.push({ amount, auth: req.headers.authorization ?? '' });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ id: `order_e2e_${Date.now()}_${orders.length}`, amount, currency: 'INR' }));
    });
  });
  await new Promise<void>((r) => fake.listen(4199, r));
});
after(() => fake.close());
startApi(4101, { ...RZP, RAZORPAY_BASE_URL: 'http://localhost:4199' });

const sign = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');
let payCount = 0;

async function webhook(event: string, orderId: string, paymentId: string, amount: number, secret = RZP.RAZORPAY_WEBHOOK_SECRET) {
  const body = JSON.stringify({ event, payload: { payment: { entity: { id: paymentId, order_id: orderId, amount } } } });
  const res = await fetch('http://localhost:4101/payments/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': sign(secret, body) }, // no Origin: server-to-server
    body,
  });
  return res.status;
}

// Pay the AVANTRA fee through the fake Razorpay + a signed webhook.
async function payFee(cookie: string) {
  const pay = await call('/payments/fee', {}, cookie);
  assert.equal(pay.status, 201, JSON.stringify(pay.json));
  assert.equal(await webhook('payment.captured', pay.json.orderId, `pay_${Date.now()}_${++payCount}`, pay.json.amount), 200);
}

async function event(adminCookie: string, fields: object) {
  const res = await call('/admin/events', { slug: `e2e-${Date.now()}-${++payCount}`, name: 'E2E Event', category: 'TECHNOLOGY', teamMin: 1, teamMax: 1, ...fields }, adminCookie);
  assert.equal(res.status, 201, JSON.stringify(res.json));
  return res.json.id as string;
}

test('exhibition fee once per student: Razorpay order + webhook, idempotency, only exhibition needs it', async () => {
  const { cookie: adminCookie } = await admin();
  const eventId = await event(adminCookie, { category: 'EXHIBITION', teamMax: 3, capacity: 1 });
  const freeEvent = await event(adminCookie, {});
  const [a, b] = [await student('a'), await student('b')];
  assert.equal((await call('/admin/events', { slug: 'nope-x', name: 'Nope', category: 'WORKSHOP', teamMin: 1, teamMax: 1 }, a.cookie)).status, 403, 'students cannot create events');

  // Unpaid: can't enter the exhibition, but every other event is free. No profile: can't pay or register.
  assert.equal((await call('/registrations', { eventId }, a.cookie)).status, 403);
  assert.equal((await call('/registrations', { eventId: freeEvent }, a.cookie)).status, 201);
  const noProfile = await signUp('STUDENT', 'noprofile');
  assert.equal((await call('/payments/fee', {}, noProfile.cookie)).status, 403);
  assert.equal((await call('/registrations', { eventId: freeEvent }, noProfile.cookie)).status, 403);

  const pay = await call('/payments/fee', {}, a.cookie);
  assert.equal(pay.status, 201);
  assert.equal(pay.json.amount, 19900);
  assert.equal(orders.at(-1)!.amount, 19900, 'amount comes from the server');
  assert.equal(orders.at(-1)!.auth, `Basic ${Buffer.from('rzp_test_e2e:key-secret-e2e').toString('base64')}`);
  const orderId = pay.json.orderId;

  // Forged signatures and wrong amounts don't mark anyone paid.
  assert.equal((await call('/payments/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_x', razorpay_signature: 'a'.repeat(64) }, a.cookie)).status, 400);
  assert.equal(await webhook('payment.captured', orderId, 'pay_a', 19900, 'wrong-secret'), 400);
  assert.equal(await webhook('payment.captured', orderId, 'pay_a', 100), 200);
  assert.ok(logs().includes(`Order ${orderId}: paid 100`));
  assert.equal((await call('/profile', undefined, a.cookie)).json.student.feePaidAt, null);

  // Real webhook marks paid; Razorpay retries and the browser callback are harmless repeats.
  const payId = `pay_a_${Date.now()}`;
  assert.equal(await webhook('payment.captured', orderId, payId, 19900), 200);
  assert.equal(await webhook('payment.captured', orderId, payId, 19900), 200);
  const sig = sign(RZP.RAZORPAY_KEY_SECRET, `${orderId}|${payId}`);
  assert.equal((await call('/payments/verify', { razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: sig }, a.cookie)).status, 200);
  await sleep(500);
  assert.equal(logs().split(`to ${a.email} | AVANTRA 2026: exhibition fee received`).length - 1, 1, 'exactly one confirmation email');
  assert.ok((await call('/profile', undefined, a.cookie)).json.student.feePaidAt);
  assert.equal((await call('/payments/fee', {}, a.cookie)).status, 409, 'pay once');

  // Paid: event entries are free. Capacity 1 → b is turned away until a withdraws.
  await payFee(b.cookie);
  const reg = await call('/registrations', { eventId }, a.cookie);
  assert.equal(reg.status, 201);
  assert.equal((await call('/registrations', { eventId }, a.cookie)).status, 409, 'once per event');
  assert.equal((await call('/registrations', { eventId }, b.cookie)).status, 409, 'event full');
  assert.equal((await call('/events')).json.find((e: { id: string }) => e.id === eventId).spotsLeft, 0);
  assert.equal((await call(`/registrations/${reg.json.id}`, undefined, b.cookie, { method: 'DELETE' })).status, 404, "can't withdraw someone else");
  assert.equal((await call(`/registrations/${reg.json.id}`, undefined, a.cookie, { method: 'DELETE' })).status, 204);
  assert.equal((await call('/registrations', { eventId }, b.cookie)).status, 201, 'spot freed');
});

test('teams: create, join by code, full, new code, remove, leave hands over leadership, solo', async () => {
  const { cookie: adminCookie } = await admin();
  const eventId = await event(adminCookie, { category: 'EXHIBITION', teamMin: 2, teamMax: 3 });
  const [a, b, c, d] = [await student('ta'), await student('tb'), await student('tc'), await student('td')];
  for (const s of [a, b, c, d]) {
    await payFee(s.cookie);
    assert.equal((await call('/registrations', { eventId }, s.cookie)).status, 201);
  }

  assert.equal((await call('/teams', { eventId, name: 'No Project' }, a.cookie)).status, 400, 'exhibition needs title + topic');
  const team = await call('/teams', { eventId, name: 'Solar Squad', projectTitle: 'Solar Bot', topic: 'Robotics' }, a.cookie);
  assert.equal(team.status, 201);
  assert.match(team.json.inviteCode, /^[2-9A-HJ-NP-Z]{6}$/);
  assert.deepEqual([team.json.members.length, team.json.complete, team.json.full], [1, false, false]);
  assert.equal((await call('/teams', { eventId, name: 'Second', projectTitle: 'X Bot', topic: 'Robotics' }, a.cookie)).status, 409, 'one team per event');

  // Codes are case-insensitive; joining needs your own registration for that event.
  const outsider = await student('outsider');
  assert.equal((await call('/teams/join', { inviteCode: team.json.inviteCode }, outsider.cookie)).status, 403);
  assert.equal((await call('/teams/join', { inviteCode: 'ZZZZZZ' }, b.cookie)).status, 404);
  const joined = await call('/teams/join', { inviteCode: team.json.inviteCode.toLowerCase() }, b.cookie);
  assert.deepEqual([joined.status, joined.json.members.length, joined.json.complete], [200, 2, true]);
  assert.equal((await call('/teams/join', { inviteCode: team.json.inviteCode }, c.cookie)).json.full, true);
  assert.equal((await call('/teams/join', { inviteCode: team.json.inviteCode }, d.cookie)).status, 409, 'team full');
  assert.equal((await call(`/teams/${team.json.id}`, undefined, d.cookie)).status, 404, 'non-members cannot see the team or its code');

  // In a team: withdraw from the event only after leaving.
  const cReg = (await call('/registrations/mine', undefined, c.cookie)).json.find((r: { eventId: string }) => r.eventId === eventId);
  assert.equal((await call(`/registrations/${cReg.id}`, undefined, c.cookie, { method: 'DELETE' })).status, 409);

  // Only the leader manages. A new code kills the old one.
  assert.equal((await call(`/teams/${team.json.id}/invite-code`, {}, b.cookie)).status, 403);
  const newCode = (await call(`/teams/${team.json.id}/invite-code`, {}, a.cookie)).json.inviteCode;
  assert.notEqual(newCode, team.json.inviteCode);

  // Leader removes b: b stays registered for the event, just no team.
  const bReg = joined.json.members.find((m: { avantraId: string }) => m.avantraId === b.avantraId).registrationId;
  assert.equal((await call(`/teams/${team.json.id}/members/${bReg}`, undefined, a.cookie, { method: 'DELETE' })).status, 204);
  const bMine = (await call('/registrations/mine', undefined, b.cookie)).json.find((r: { eventId: string }) => r.eventId === eventId);
  assert.equal(bMine.teamMember, null);
  assert.equal((await call('/teams/join', { inviteCode: team.json.inviteCode }, b.cookie)).status, 404, 'old code dead');

  // Leader leaves: c (next to join) becomes leader. Last one out deletes the team.
  assert.equal((await call(`/teams/${team.json.id}/leave`, {}, a.cookie)).status, 204);
  const left = await call(`/teams/${team.json.id}`, undefined, c.cookie);
  assert.deepEqual(left.json.members.map((m: { avantraId: string; isLeader: boolean }) => [m.avantraId, m.isLeader]), [[c.avantraId, true]]);
  assert.equal((await call(`/teams/${team.json.id}/leave`, {}, c.cookie)).status, 204);
  assert.equal((await call('/teams/join', { inviteCode: newCode }, d.cookie)).status, 404, 'empty team deleted');

  // Solo event: a team of one is created automatically; withdrawing removes it.
  const soloId = await event(adminCookie, { category: 'WORKSHOP' });
  const soloReg = await call('/registrations', { eventId: soloId }, d.cookie);
  assert.equal(soloReg.status, 201);
  const dSolo = (await call('/registrations/mine', undefined, d.cookie)).json.find((r: { eventId: string }) => r.eventId === soloId);
  assert.equal(dSolo.teamMember.team.members.length, 1);
  assert.equal((await call(`/teams/${dSolo.teamMember.team.id}/leave`, {}, d.cookie)).status, 400);
  assert.equal((await call(`/registrations/${soloReg.json.id}`, undefined, d.cookie, { method: 'DELETE' })).status, 204);
  assert.equal((await call(`/teams/${dSolo.teamMember.team.id}`, undefined, d.cookie)).status, 404, 'solo team removed');

  // Closing registration blocks new entries.
  assert.equal((await call(`/admin/events/${soloId}`, { registrationOpen: false }, adminCookie, { method: 'PATCH' })).status, 200);
  assert.equal((await call('/registrations', { eventId: soloId }, a.cookie)).status, 400);
});
