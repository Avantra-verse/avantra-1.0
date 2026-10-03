// End-to-end events, team registration and Razorpay payment flow, against a fake Razorpay server.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { admin, call, logs, sleep, startApi, student } from './helpers.ts';

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

async function webhook(event: string, orderId: string, paymentId: string, amount: number, secret = RZP.RAZORPAY_WEBHOOK_SECRET) {
  const body = JSON.stringify({ event, payload: { payment: { entity: { id: paymentId, order_id: orderId, amount } } } });
  const res = await fetch('http://localhost:4101/payments/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': sign(secret, body) }, // no Origin: server-to-server
    body,
  });
  return res.status;
}

test('team registration, capacity, Razorpay order + webhook, idempotency, free events', async () => {
  const { cookie: adminCookie } = await admin();
  const slug = `e2e-exh-${Date.now()}`;
  const ev = await call('/admin/events', { slug, name: 'E2E Exhibition', category: 'EXHIBITION', feePaise: 19900, teamMin: 1, teamMax: 3, capacity: 1 }, adminCookie);
  assert.equal(ev.status, 201);
  const eventId = ev.json.id;

  const [a, b, c] = [await student('lead'), await student('mate'), await student('late')];
  assert.equal((await call('/admin/events', { slug: `${slug}-x`, name: 'Nope', category: 'WORKSHOP', feePaise: 0, teamMin: 1, teamMax: 1 }, a.cookie)).status, 403, 'students cannot create events');

  // Exhibition needs title + topic; unknown teammates are rejected.
  assert.equal((await call('/registrations', { eventId, memberAvantraIds: [b.avantraId] }, a.cookie)).status, 400);
  assert.equal((await call('/registrations', { eventId, memberAvantraIds: ['AV26-ZZZZZ'], projectTitle: 'Solar Bot', topic: 'Robotics' }, a.cookie)).status, 400);
  const reg = await call('/registrations', { eventId, memberAvantraIds: [b.avantraId.toLowerCase()], projectTitle: 'Solar Bot', topic: 'Robotics' }, a.cookie);
  assert.equal(reg.status, 201);
  assert.equal(reg.json.status, 'PENDING_PAYMENT');

  // B is already in a team for this event; event is full (capacity 1, unpaid hold counts).
  assert.equal((await call('/registrations', { eventId, projectTitle: 'Other', topic: 'Robotics' }, b.cookie)).status, 409);
  assert.equal((await call('/registrations', { eventId, projectTitle: 'Late', topic: 'Robotics' }, c.cookie)).status, 409);
  assert.equal((await call('/events')).json.find((e: { id: string }) => e.id === eventId).spotsLeft, 0);

  // Only the leader can pay. Amount = fee × team size, computed on the server.
  assert.equal((await call(`/registrations/${reg.json.id}/pay`, {}, b.cookie)).status, 404);
  const pay = await call(`/registrations/${reg.json.id}/pay`, {}, a.cookie);
  assert.equal(pay.status, 201);
  assert.equal(pay.json.amount, 2 * 19900);
  assert.equal(orders.at(-1)!.amount, 2 * 19900);
  assert.equal(orders.at(-1)!.auth, `Basic ${Buffer.from('rzp_test_e2e:key-secret-e2e').toString('base64')}`);
  const orderId = pay.json.orderId;

  // Forged signatures and wrong amounts don't confirm anything.
  assert.equal((await call('/payments/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_x', razorpay_signature: 'a'.repeat(64) }, a.cookie)).status, 400);
  assert.equal(await webhook('payment.captured', orderId, 'pay_e2e', 2 * 19900, 'wrong-secret'), 400);
  assert.equal(await webhook('payment.captured', orderId, 'pay_e2e', 100), 200);
  assert.ok(logs().includes(`Order ${orderId}: paid 100`));
  assert.equal((await call('/registrations/mine', undefined, a.cookie)).json[0].status, 'PENDING_PAYMENT');

  // Real webhook confirms; Razorpay retries and the browser callback are harmless repeats.
  assert.equal(await webhook('payment.captured', orderId, 'pay_e2e', 2 * 19900), 200);
  assert.equal(await webhook('payment.captured', orderId, 'pay_e2e', 2 * 19900), 200);
  const sig = sign(RZP.RAZORPAY_KEY_SECRET, `${orderId}|pay_e2e`);
  assert.equal((await call('/payments/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_e2e', razorpay_signature: sig }, a.cookie)).status, 200);
  await sleep(500);
  assert.equal(logs().split('registration confirmed').length - 1, 1, 'exactly one confirmation email');

  const mineB = (await call('/registrations/mine', undefined, b.cookie)).json;
  assert.equal(mineB[0].status, 'CONFIRMED');
  assert.equal(mineB[0].members.length, 2);
  assert.equal((await call(`/registrations/${reg.json.id}`, undefined, a.cookie, { method: 'DELETE' })).status, 409, 'paid = no self-cancel');

  // Free event: confirmed straight away, no payment.
  const free = await call('/admin/events', { slug: `${slug}-free`, name: 'E2E Workshop', category: 'WORKSHOP', feePaise: 0, teamMin: 1, teamMax: 1 }, adminCookie);
  const freeReg = await call('/registrations', { eventId: free.json.id }, c.cookie);
  assert.equal(freeReg.json.status, 'CONFIRMED');
  assert.equal((await call(`/registrations/${freeReg.json.id}/pay`, {}, c.cookie)).status, 409);

  // Closing registration blocks new entries.
  assert.equal((await call(`/admin/events/${free.json.id}`, { registrationOpen: false }, adminCookie, { method: 'PATCH' })).status, 200);
  assert.equal((await call('/registrations', { eventId: free.json.id }, b.cookie)).status, 400);
});
