import { Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';

// No 0/O/1/I, so codes can be read aloud and typed without mistakes.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const randomCode = (length: number) => Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export const isUniqueViolation = (e: unknown): e is Prisma.PrismaClientKnownRequestError =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
