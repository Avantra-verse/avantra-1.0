import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

// OWASP argon2id minimum: 19 MiB memory, 2 passes, 1 lane.
const PARAMS = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };

function derive(password: string, nonce: Buffer, p = PARAMS): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    argon2('argon2id', { message: password, nonce, ...p }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

// Stored as argon2id$m=19456,t=2,p=1$<salt hex>$<hash hex> so params can change later.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  const { memory: m, passes: t, parallelism: p } = PARAMS;
  return `argon2id$m=${m},t=${t},p=${p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, params, saltHex, hashHex] = stored.split('$');
  if (alg !== 'argon2id' || !params || !saltHex || !hashHex) return false;
  const v = Object.fromEntries(params.split(',').map((kv) => kv.split('=')));
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await derive(password, Buffer.from(saltHex, 'hex'), {
    memory: Number(v.m),
    passes: Number(v.t),
    parallelism: Number(v.p),
    tagLength: expected.length,
  });
  return timingSafeEqual(actual, expected);
}
