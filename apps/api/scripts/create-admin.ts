// Usage: pnpm --filter @avantra/api create-admin <email> "<name>"
// Creates (or resets) an ADMIN account and prints a random password once. Admin login also needs the emailed code.
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../src/auth/password.ts';

try {
  process.loadEnvFile();
} catch {}
const [email, name] = process.argv.slice(2);
if (!email?.includes('@') || !name) {
  console.error('Usage: create-admin <email> "<name>"');
  process.exit(1);
}
const password = randomBytes(12).toString('base64url');
const prisma = new PrismaClient();
const data = { name, role: 'ADMIN' as const, passwordHash: await hashPassword(password), emailVerifiedAt: new Date(), disabledAt: null };
await prisma.user.upsert({ where: { email: email.toLowerCase() }, create: { email: email.toLowerCase(), ...data }, update: data });
await prisma.$disconnect();
console.log(`Admin ${email.toLowerCase()} ready. Password (shown once): ${password}`);
