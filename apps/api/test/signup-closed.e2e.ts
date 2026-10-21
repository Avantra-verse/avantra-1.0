// Before STUDENT_SIGNUP=open: ambassadors can sign up, students can't.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, startApi } from './helpers.ts';

startApi(4110, { STUDENT_SIGNUP: 'closed' });

test('student sign-up stays closed until STUDENT_SIGNUP=open', async () => {
  const body = (role: string) => ({ role, name: 'Test closed', email: `e2e-closed-${role}-${Date.now()}@example.com`, password: 'a-good-password' });
  const student = await call('/auth/register', body('STUDENT'));
  assert.equal(student.status, 403);
  assert.equal(student.json.message, 'Student registration opens soon');
  assert.equal((await call('/auth/register/verify', { ...body('STUDENT'), code: '123456' })).status, 403);
  assert.equal((await call('/auth/register', body('AMBASSADOR'))).status, 202);
});
