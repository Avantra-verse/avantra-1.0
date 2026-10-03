import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './password.ts';

test('argon2id hash round-trips and rejects wrong passwords', async () => {
  const stored = await hashPassword('correct horse battery');
  assert.match(stored, /^argon2id\$m=19456,t=2,p=1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  assert.equal(await verifyPassword('correct horse battery', stored), true);
  assert.equal(await verifyPassword('wrong password', stored), false);
  assert.equal(await verifyPassword('anything', 'garbage'), false);
});
