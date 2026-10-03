import { createHmac, timingSafeEqual } from 'node:crypto';

// Razorpay over plain HTTPS: one REST call and two HMAC checks, no SDK needed.
// RAZORPAY_BASE_URL is only overridden by the e2e test (fake Razorpay server).
const base = () => process.env.RAZORPAY_BASE_URL ?? 'https://api.razorpay.com';

export const razorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export async function createOrder(amountPaise: number, receipt: string): Promise<{ id: string }> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`${base()}/v1/orders`, {
    method: 'POST',
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }),
  });
  if (!res.ok) throw new Error(`Razorpay order failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ id: string }>;
}

export function hmacMatches(secret: string, data: string | Buffer, signatureHex: string): boolean {
  const expected = createHmac('sha256', secret).update(data).digest();
  const given = Buffer.from(signatureHex, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
