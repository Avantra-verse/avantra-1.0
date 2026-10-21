// End-to-end auth, profile, admin and staff checks against a real API + Postgres + Redis.
// Run: pnpm db:up, then pnpm build && pnpm test:e2e
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { call, clearLogs, codeFor, logs, signUp, sleep, startApi } from './helpers.ts';

startApi(4100);

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
  clearLogs();
  assert.equal((await call('/auth/register', signup)).status, 202);
  await sleep(500);
  assert.ok(!logs().includes(`to ${email}`), 'no email for an existing account');

  const me = await call('/auth/me', undefined, verified.cookie);
  assert.equal(me.json.email, email);
  assert.equal((await call('/auth/me')).status, 401, 'no cookie, no access');

  // Wrong tab and wrong password give the same message.
  const wrongTab = await call('/auth/login', { role: 'AMBASSADOR', email, password: 'first-password-1' });
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
  clearLogs();
  assert.equal((await call('/auth/password/forgot', { email })).status, 202);
  const resetCode = await codeFor(email);
  assert.equal((await call('/auth/password/reset', { email, code: resetCode, password: 'second-password-2' })).status, 200);
  assert.equal((await call('/auth/me', undefined, verified.cookie)).status, 401, 'reset revokes old sessions');
  assert.equal((await call('/auth/login', { role: 'STUDENT', email, password: 'first-password-1' })).status, 401);
  assert.equal((await call('/auth/login', { role: 'STUDENT', email, password: 'second-password-2' })).status, 200);

  // Another site can't make changes with our cookie.
  assert.equal((await call('/auth/login', { role: 'STUDENT', email, password: 'second-password-2' }, '', { origin: 'https://evil.arithi.in' })).status, 403);
  // Bad input is rejected by the shared zod schema.
  assert.equal((await call('/auth/register', { ...signup, email: 'not-an-email' })).status, 400);
});

test('profiles, ambassadors and referrals, admin login, staff', async () => {
  // Admin via the one-off script, then password + emailed code.
  const adminEmail = `e2e-admin-${Date.now()}@example.com`;
  const out = spawnSync(process.execPath, ['--no-warnings', 'scripts/create-admin.ts', adminEmail, 'Test Admin'], { encoding: 'utf8' });
  const adminPw = out.stdout.match(/shown once\): (\S+)/)?.[1];
  assert.ok(adminPw, out.stderr);
  assert.equal((await call('/auth/admin/login', { email: adminEmail, password: 'wrong-password' })).status, 401);
  const adminRes = await call('/auth/admin/login', { email: adminEmail, password: adminPw });
  assert.equal(adminRes.status, 200);
  const admin = adminRes.cookie;
  assert.equal((await call('/auth/login', { role: 'STUDENT', email: adminEmail, password: adminPw })).status, 401, 'admin cannot use public login');

  // Ambassador: profile gives a 6-character code to share.
  const amb = await signUp('AMBASSADOR', 'amb');
  assert.equal((await call('/auth/me', undefined, amb.cookie)).json.profileComplete, false);
  const ambProfile = { phone: '9876543210', schoolName: 'E2E Ambassador School' };
  const ambassador = await call('/profile/ambassador', ambProfile, amb.cookie);
  assert.equal(ambassador.status, 201);
  assert.match(ambassador.json.code, /^[2-9A-HJ-NP-Z]{6}$/);
  assert.equal((await call('/profile/ambassador', ambProfile, amb.cookie)).status, 409, 'one profile');
  assert.equal((await call('/auth/me', undefined, amb.cookie)).json.profileComplete, true);

  // Student: typed school, optional ambassador code (any case), profile only once.
  const student = await signUp('STUDENT', 'student');
  const profile = { phone: '9876500000', grade: 9, guardianPhone: '9876511111', guardianConsent: true, schoolName: 'E2E School' };
  assert.equal((await call('/profile/student', { ...profile, guardianConsent: false }, student.cookie)).status, 400, 'consent required');
  assert.equal((await call('/profile/student', { ...profile, referralCode: 'ZZZZZZ' }, student.cookie)).status, 400, 'unknown code');
  const created = await call('/profile/student', { ...profile, referralCode: ` ${ambassador.json.code.toLowerCase()} ` }, student.cookie);
  assert.equal(created.status, 201);
  assert.match(created.json.avantraId, /^AV26-[2-9A-HJ-NP-Z]{5}$/);
  assert.equal((await call('/profile/student', profile, student.cookie)).status, 409);

  // Role checks: nobody but admin reaches /admin, only ambassadors see their referrals.
  assert.equal((await call('/admin/ambassadors', undefined, amb.cookie)).status, 403);
  assert.equal((await call('/ambassador/referrals', undefined, student.cookie)).status, 403);
  const referrals = (await call('/ambassador/referrals', undefined, amb.cookie)).json;
  assert.deepEqual(referrals.map((r: { user: { name: string }; feePaidAt: null }) => [r.user.name, r.feePaidAt]), [['Test student', null]]);

  // Admin sees the count: 1 sign-up, 0 paid. Paying moves it to 1 paid.
  const count = async () => (await call('/admin/ambassadors', undefined, admin)).json.find((a: { code: string }) => a.code === ambassador.json.code);
  assert.deepEqual([(await count()).signups, (await count()).paid], [1, 0]);
  assert.equal((await call(`/admin/students/${created.json.avantraId}/mark-paid`, { note: 'RCPT-AMB' }, admin)).status, 200);
  assert.equal((await count()).paid, 1);

  // Staff: admin creates a volunteer; it logs in on /staff only and can't reach admin.
  const volEmail = `e2e-vol-${Date.now()}@example.com`;
  const vol = await call('/admin/staff', { role: 'VOLUNTEER', name: 'Test Volunteer', email: volEmail, password: 'volunteer-pass' }, admin);
  assert.equal(vol.status, 201);
  assert.equal((await call('/auth/login', { role: 'STUDENT', email: volEmail, password: 'volunteer-pass' })).status, 401);
  const volLogin = await call('/auth/staff/login', { email: volEmail, password: 'volunteer-pass' });
  assert.equal(volLogin.status, 200);
  assert.equal((await call('/admin/ambassadors', undefined, volLogin.cookie)).status, 403);
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
