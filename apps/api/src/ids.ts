import { Prisma } from '@prisma/client';
import { randomBytes, randomInt } from 'node:crypto';

// No 0/O/1/I, so codes can be read aloud and typed without mistakes.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const randomCode = (length: number) => Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export const isUniqueViolation = (e: unknown): e is Prisma.PrismaClientKnownRequestError =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

export const newStudentIds = () => ({ avantraId: 'AV26-' + randomCode(5), qrToken: randomBytes(16).toString('base64url') });

// Retry when a freshly generated random ID collides with an existing one (unique violation on one of `fields`).
// Any other error, including other unique violations like a taken email, is thrown as-is.
export async function retryOnIdClash<T>(fields: string[], create: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await create();
    } catch (e) {
      const clash = isUniqueViolation(e) && fields.some((f) => String(e.meta?.target).includes(f));
      if (!clash || attempt >= 5) throw e;
    }
  }
}
