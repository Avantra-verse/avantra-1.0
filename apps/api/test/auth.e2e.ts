// End-to-end auth check against a real API + Postgres + Redis (pnpm db:up, then pnpm build && pnpm test:e2e).
// Codes are read from the API console, which is where emails go when SMTP_HOST is empty.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

process.loadEnvFile();
const PORT = 4100;
const API = `http://localhost:${PORT}`;
const ORIGIN = process.env.WEB_ORIGIN!;
let api: ChildProcess;
let logs = '';

before(async () => {
  // NODE_TEST_CONTEXT would make the child report to the test runner instead of printing logs.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  api = spawn(process.execPath, ['dist/main.js'], { env: { ...env, PORT: String(PORT), NODE_ENV: 'test' } });
  api.stdout!.on('data', (d) => (logs += d));
  api.stderr!.on('data', (d) => (logs += d));
  for (let i = 0; i < 300 && !logs.includes('successfully started'); i++) await new Promise((r) => setTimeout(r, 100));
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

async function signUp(role: 'STUDENT' | 'SCHOOL_COORDINATOR', tag: string) {
  const email = `e2e-${tag}-${Date.now()}@example.com`;
  const body = { role, name: `Test ${tag}`, email, password: 'a-good-password' };
  assert.equal((await call('/auth/register', body)).status, 202);
  const res = await call('/auth/register/verify', { ...body, code: await codeFor(email) });
  assert.equal(res.status, 200);
  return { email, cookie: res.cookie };
}

test('profiles, school approval, coordinator scoping, admin 2-step, staff', async () => {
  // Admin via the one-off script, then password + emailed code.
  const adminEmail = `e2e-admin-${Date.now()}@example.com`;
  const out = spawnSync(process.execPath, ['--no-warnings', 'scripts/create-admin.ts', adminEmail, 'Test Admin'], { encoding: 'utf8' });
  const adminPw = out.stdout.match(/shown once\): (\S+)/)?.[1];
  assert.ok(adminPw, out.stderr);
  assert.equal((await call('/auth/admin/login', { email: adminEmail, password: 'wrong-password' })).status, 401);
  assert.equal((await call('/auth/admin/verify', { email: adminEmail, code: '123456' })).status, 404, 'no route like that');
  assert.equal((await call('/auth/admin/login', { email: adminEmail, password: adminPw })).status, 202);
  const adminRes = await call('/auth/admin/login/verify', { email: adminEmail, code: await codeFor(adminEmail) });
  assert.equal(adminRes.status, 200);
  const admin = adminRes.cookie;
  assert.equal((await call('/auth/login', { role: 'STUDENT', email: adminEmail, password: adminPw })).status, 401, 'admin cannot use public login');

  // Coordinator registers a school: pending, not in the dropdown, no students visible yet.
  const coord = await signUp('SCHOOL_COORDINATOR', 'coord');
  const schoolName = `E2E School ${Date.now()}`;
  const school = await call('/profile/school', { schoolName, city: 'Rourkela', address: 'Sector 20, Rourkela', phone: '9876543210' }, coord.cookie);
  assert.equal(school.status, 201);
  assert.equal(school.json.status, 'PENDING');
  assert.equal((await call('/profile/school', { schoolName: `${schoolName} 2`, city: 'Rourkela', address: 'Sector 20, Rourkela', phone: '9876543210' }, coord.cookie)).status, 409, 'one school per coordinator');
  assert.ok(!(await call('/schools')).json.some((s: { id: string }) => s.id === school.json.id), 'pending school hidden');
  assert.equal((await call('/auth/me', undefined, coord.cookie)).json.profileComplete, true);

  // Student: can't pick a pending school; "Others" works; profile only once.
  const student = await signUp('STUDENT', 'student');
  const profile = { phone: '9876500000', grade: 9, guardianPhone: '9876511111', guardianConsent: true };
  assert.equal((await call('/profile/student', { ...profile, schoolId: school.json.id }, student.cookie)).status, 403);
  assert.equal((await call('/profile/student', { ...profile, guardianConsent: false, otherSchoolName: schoolName }, student.cookie)).status, 400, 'consent required');
  const created = await call('/profile/student', { ...profile, otherSchoolName: schoolName }, student.cookie);
  assert.equal(created.status, 201);
  assert.match(created.json.avantraId, /^AV26-[2-9A-HJ-NP-Z]{5}$/);
  assert.equal((await call('/profile/student', { ...profile, otherSchoolName: schoolName }, student.cookie)).status, 409);

  // Role checks: nobody but admin reaches /admin, only coordinators see coordinator data.
  assert.equal((await call('/admin/schools', undefined, coord.cookie)).status, 403);
  assert.equal((await call('/coordinator/students', undefined, student.cookie)).status, 403);
  assert.deepEqual((await call('/coordinator/students', undefined, coord.cookie)).json, []);

  // Admin approves the school and links the "Others" student to it.
  assert.equal((await call(`/admin/schools/${school.json.id}/approve`, {}, admin)).json.status, 'APPROVED');
  assert.ok((await call('/schools')).json.some((s: { id: string }) => s.id === school.json.id), 'approved school listed');
  const unlinked = (await call('/admin/students/unlinked', undefined, admin)).json;
  const row = unlinked.find((s: { avantraId: string }) => s.avantraId === created.json.avantraId);
  assert.ok(row);
  assert.equal((await call(`/admin/students/${row.userId}/link`, { schoolId: school.json.id }, admin)).status, 200);
  const mine = (await call('/coordinator/students', undefined, coord.cookie)).json;
  assert.deepEqual(mine.map((s: { avantraId: string }) => s.avantraId), [created.json.avantraId]);

  // Staff: admin creates a volunteer; it logs in on /staff only and can't reach admin.
  const volEmail = `e2e-vol-${Date.now()}@example.com`;
  const vol = await call('/admin/staff', { role: 'VOLUNTEER', name: 'Test Volunteer', email: volEmail, password: 'volunteer-pass' }, admin);
  assert.equal(vol.status, 201);
  assert.equal((await call('/auth/login', { role: 'STUDENT', email: volEmail, password: 'volunteer-pass' })).status, 401);
  const volLogin = await call('/auth/staff/login', { email: volEmail, password: 'volunteer-pass' });
  assert.equal(volLogin.status, 200);
  assert.equal((await call('/admin/schools', undefined, volLogin.cookie)).status, 403);
  assert.equal((await call('/auth/staff/login', { email: student.email, password: 'a-good-password' })).status, 401, 'students cannot use /staff');

  // Disable = logged out everywhere and can't log back in.
  assert.equal((await call(`/admin/users/${vol.json.id}/disable`, {}, admin)).status, 200);
  assert.equal((await call('/auth/me', undefined, volLogin.cookie)).status, 401);
  assert.equal((await call('/auth/staff/login', { email: volEmail, password: 'volunteer-pass' })).status, 401);

  // Expired staff account can't log in.
  const oldEmail = `e2e-old-${Date.now()}@example.com`;
  await call('/admin/staff', { role: 'JUDGE', name: 'Old Judge', email: oldEmail, password: 'judge-password', expiresAt: '2020-01-01' }, admin);
  assert.equal((await call('/auth/staff/login', { email: oldEmail, password: 'judge-password' })).status, 401);
});
