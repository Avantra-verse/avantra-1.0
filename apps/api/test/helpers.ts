// Shared by the e2e tests. Each test file runs in its own process, so it starts its own API on its own port.
// Emails (codes) are read from the API console, which is where they go when SMTP_HOST is empty.
import { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

process.loadEnvFile();
const ORIGIN = process.env.WEB_ORIGIN!;
let API = '';
let output = '';

export const logs = () => output;
export const clearLogs = () => void (output = '');

export function startApi(port: number, env: Record<string, string> = {}) {
  let api: ChildProcess;
  API = `http://localhost:${port}`;
  before(async () => {
    // NODE_TEST_CONTEXT would make the child report to the test runner instead of printing logs.
    const { NODE_TEST_CONTEXT, ...parentEnv } = process.env;
    api = spawn(process.execPath, ['dist/main.js'], { env: { ...parentEnv, ...env, PORT: String(port), NODE_ENV: 'test' } });
    api.stdout!.on('data', (d) => (output += d));
    api.stderr!.on('data', (d) => (output += d));
    for (let i = 0; i < 300 && !output.includes('successfully started'); i++) await sleep(100);
    assert.ok(output.includes('successfully started'), `API did not start:\n${output}`);
  });
  after(() => api.kill());
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function call(path: string, body?: object, cookie = '', opts: { origin?: string; method?: string } = {}) {
  const res = await fetch(API + path, {
    method: opts.method ?? (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', origin: opts.origin ?? ORIGIN, cookie },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  const cookieOut = res.headers.get('set-cookie')?.split(';')[0] ?? '';
  const isJson = res.headers.get('content-type')?.includes('json');
  return { status: res.status, json: isJson && text ? JSON.parse(text) : null, text, headers: res.headers, cookie: cookieOut };
}

export async function codeFor(email: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const m = [...output.matchAll(new RegExp(`to ${email} \\|[\\s\\S]*?code is (\\d{6})`, 'g'))].pop();
    if (m) return m[1];
    await sleep(100);
  }
  throw new Error(`no code emailed to ${email}`);
}

const unique = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

export async function signUp(role: 'STUDENT' | 'SCHOOL_COORDINATOR', tag: string) {
  const email = unique(tag);
  const body = { role, name: `Test ${tag}`, email, password: 'a-good-password' };
  assert.equal((await call('/auth/register', body)).status, 202);
  const res = await call('/auth/register/verify', { ...body, code: await codeFor(email) });
  assert.equal(res.status, 200);
  return { email, cookie: res.cookie };
}

// Signed-up student with a profile ("Others" school). Returns their AVANTRA ID too.
export async function student(tag: string) {
  const s = await signUp('STUDENT', tag);
  const profile = { phone: '9876500000', grade: 9, guardianPhone: '9876511111', guardianConsent: true, otherSchoolName: 'E2E Test School' };
  const res = await call('/profile/student', profile, s.cookie);
  assert.equal(res.status, 201);
  return { ...s, avantraId: res.json.avantraId as string };
}

// Admin via the create-admin script, then password + emailed code. Returns the session cookie.
export async function admin() {
  const email = unique('admin');
  const out = spawnSync(process.execPath, ['--no-warnings', 'scripts/create-admin.ts', email, 'Test Admin'], { encoding: 'utf8' });
  const password = out.stdout.match(/shown once\): (\S+)/)?.[1];
  assert.ok(password, out.stderr);
  assert.equal((await call('/auth/admin/login', { email, password })).status, 202);
  const res = await call('/auth/admin/login/verify', { email, code: await codeFor(email) });
  assert.equal(res.status, 200);
  return { email, password, cookie: res.cookie };
}
