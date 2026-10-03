// End-to-end auth check against a real API + Postgres + Redis (pnpm db:up, then pnpm build && pnpm test:e2e).
// Codes are read from the API console, which is where emails go when SMTP_HOST is empty.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';

process.loadEnvFile();
const PORT = 4100;
const API = `http://localhost:${PORT}`;
const ORIGIN = process.env.WEB_ORIGIN!;
let api: ChildProcess;
let logs = '';

before(async () => {
  // NODE_TEST_CONTEXT would make the child report to the test runner instead of printing logs.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  api = spawn(process.execPath, ['dist/main.js'], { env: { ...env, PORT: String(PORT) } });
  api.stdout!.on('data', (d) => (logs += d));
  api.stderr!.on('data', (d) => (logs += d));
  for (let i = 0; i < 100 && !logs.includes('successfully started'); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(logs.includes('successfully started'), `API did not start:\n${logs}`);
});
after(() => api.kill());

async function call(path: string, body?: object, cookie = '', origin = ORIGIN) {
  const res = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', origin, cookie },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  const cookieOut = res.headers.get('set-cookie')?.split(';')[0] ?? '';
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: cookieOut };
}

async function codeFor(email: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const m = [...logs.matchAll(new RegExp(`to ${email} \\|[\\s\\S]*?code is (\\d{6})`, 'g'))].pop();
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no code emailed to ${email}`);
}

test('sign-up, login, wrong tab, logout, password reset, CSRF', async () => {
  const email = `e2e-${Date.now()}@example.com`;
  const signup = { role: 'STUDENT', name: 'Test Student', email, password: 'first-password-1' };

  assert.equal((await call('/auth/register', signup)).status, 202);
  const code = await codeFor(email);
  assert.equal((await call('/auth/register/verify', { ...signup, code: code === '000000' ? '111111' : '000000' })).status, 400, 'wrong code');
  const verified = await call('/auth/register/verify', { ...signup, code });
  assert.equal(verified.status, 200);
  assert.deepEqual([verified.json.email, verified.json.role, verified.json.profileComplete], [email, 'STUDENT', false]);
  assert.equal((await call('/auth/register/verify', { ...signup, code })).status, 400, 'code is single-use');

  // Existing email: same 202, no new code.
  logs = '';
  assert.equal((await call('/auth/register', signup)).status, 202);
  await new Promise((r) => setTimeout(r, 500));
  assert.ok(!logs.includes(`to ${email}`), 'no email for an existing account');

  const me = await call('/auth/me', undefined, verified.cookie);
  assert.equal(me.json.email, email);
  assert.equal((await call('/auth/me')).status, 401, 'no cookie, no access');

  // Wrong tab and wrong password give the same message.
  const wrongTab = await call('/auth/login', { role: 'SCHOOL_COORDINATOR', email, password: 'first-password-1' });
  const wrongPw = await call('/auth/login', { role: 'STUDENT', email, password: 'nope-nope-nope' });
  const noUser = await call('/auth/login', { role: 'STUDENT', email: `x${email}`, password: 'nope-nope-nope' });
  assert.deepEqual([wrongTab.status, wrongPw.status, noUser.status], [401, 401, 401]);
  assert.equal(wrongTab.json.message, wrongPw.json.message);
  assert.equal(noUser.json.message, wrongPw.json.message);

  const login = await call('/auth/login', { role: 'STUDENT', email, password: 'first-password-1' });
  assert.equal(login.status, 200);
  assert.equal((await call('/auth/logout', {}, login.cookie)).status, 204);
  assert.equal((await call('/auth/me', undefined, login.cookie)).status, 401, 'logout kills the session');

  // Password reset logs out every device.
  logs = '';
  assert.equal((await call('/auth/password/forgot', { email })).status, 202);
  const resetCode = await codeFor(email);
  assert.equal((await call('/auth/password/reset', { email, code: resetCode, password: 'second-password-2' })).status, 200);
  assert.equal((await call('/auth/me', undefined, verified.cookie)).status, 401, 'reset revokes old sessions');
  assert.equal((await call('/auth/login', { role: 'STUDENT', email, password: 'first-password-1' })).status, 401);
  assert.equal((await call('/auth/login', { role: 'STUDENT', email, password: 'second-password-2' })).status, 200);

  // Another site can't make changes with our cookie.
  assert.equal((await call('/auth/login', { role: 'STUDENT', email, password: 'second-password-2' }, '', 'https://evil.arithi.in')).status, 403);
  // Bad input is rejected by the shared zod schema.
  assert.equal((await call('/auth/register', { ...signup, email: 'not-an-email' })).status, 400);
});
