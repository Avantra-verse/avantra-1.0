import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type {
  ForgotPasswordRequest,
  GoogleLoginRequest,
  LoginRequest,
  Me,
  PasswordLoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@avantra/shared';
import { CodePurpose, Prisma, type Role, type User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { MailService } from '../mail.service';
import { PrismaService } from '../prisma.service';
import { hashPassword, verifyPassword } from './password';
import { isActive, sha256 } from './session.guard';

const CODE_TTL_MS = 10 * 60_000;
const CODE_RESEND_MS = 60_000;
const CODE_MAX_ATTEMPTS = 5;
const DAY_MS = 24 * 60 * 60_000;
// Students/coordinators stay logged in for a month; admin and staff sessions last one working day.
export const sessionTtlMs = (role: Role) => (role === 'STUDENT' || role === 'SCHOOL_COORDINATOR' ? 30 * DAY_MS : DAY_MS / 2);

const INVALID_LOGIN = 'Invalid email or password';
const INVALID_CODE = 'Invalid or expired code';
const GOOGLE_FAILED = 'Google sign-in failed';

@Injectable()
export class AuthService {
  private readonly google = new OAuth2Client();
  // Compared against when the email is unknown, so "no such user" takes as long as "wrong password".
  private readonly dummyHash = hashPassword(randomBytes(16).toString('hex'));

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ---- sign-up: code first, account only after the code is verified ----

  async requestSignupCode({ email }: RegisterRequest): Promise<void> {
    // Existing email: same response, no email. Never reveals who has an account.
    if (await this.prisma.user.findUnique({ where: { email } })) return;
    await this.sendCode(email, CodePurpose.VERIFY_EMAIL, 'Your AVANTRA sign-up code');
  }

  async verifySignup({ role, name, email, password, code }: VerifyEmailRequest): Promise<User> {
    const passwordHash = await hashPassword(password);
    if (!(await this.consumeCode(email, CodePurpose.VERIFY_EMAIL, code))) throw new BadRequestException(INVALID_CODE);
    try {
      return await this.prisma.user.create({ data: { role, name, email, passwordHash, emailVerifiedAt: new Date() } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new BadRequestException(INVALID_CODE);
      throw e;
    }
  }

  // ---- login ----

  login({ role, email, password }: LoginRequest): Promise<User> {
    return this.checkPassword(email, password, [role]);
  }

  staffLogin({ email, password }: PasswordLoginRequest): Promise<User> {
    return this.checkPassword(email, password, ['VOLUNTEER', 'JUDGE']);
  }

  // Password only, like staff. Email codes are for sign-up and password resets.
  adminLogin({ email, password }: PasswordLoginRequest): Promise<User> {
    return this.checkPassword(email, password, ['ADMIN']);
  }

  private async checkPassword(email: string, password: string, roles: Role[]): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash));
    // One message for every failure, including wrong tab (role), so it never reveals the account type.
    if (!user?.passwordHash || !ok || !roles.includes(user.role) || !isActive(user)) throw new UnauthorizedException(INVALID_LOGIN);
    return user;
  }

  async loginWithGoogle({ role, credential }: GoogleLoginRequest): Promise<User> {
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience) throw new ServiceUnavailableException('Google sign-in is not set up yet');
    const payload = await this.google
      .verifyIdToken({ idToken: credential, audience })
      .then((t) => t.getPayload())
      .catch(() => undefined);
    if (!payload?.email || !payload.email_verified) throw new UnauthorizedException(GOOGLE_FAILED);

    const email = payload.email.toLowerCase();
    const user =
      (await this.prisma.user.findUnique({ where: { googleId: payload.sub } })) ??
      (await this.prisma.user.findUnique({ where: { email } }));
    if (!user) {
      return this.prisma.user.create({
        data: { role, email, name: payload.name ?? email, googleId: payload.sub, emailVerifiedAt: new Date() },
      });
    }
    if (user.role !== role || !isActive(user) || (user.googleId && user.googleId !== payload.sub)) {
      throw new UnauthorizedException(GOOGLE_FAILED);
    }
    // Google has verified the email, so linking it to an existing password account is safe.
    return user.googleId ? user : this.prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } });
  }

  // ---- password reset ----

  async forgotPassword({ email }: ForgotPasswordRequest): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && isActive(user)) await this.sendCode(email, CodePurpose.RESET_PASSWORD, 'Reset your AVANTRA password');
  }

  async resetPassword({ email, code, password }: ResetPasswordRequest): Promise<void> {
    const passwordHash = await hashPassword(password);
    if (!(await this.consumeCode(email, CodePurpose.RESET_PASSWORD, code))) throw new BadRequestException(INVALID_CODE);
    // New password logs out every device.
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { email }, data: { passwordHash } }),
      this.prisma.session.deleteMany({ where: { user: { email } } }),
    ]);
  }

  // ---- sessions ----

  async createSession(user: User): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + sessionTtlMs(user.role));
    await this.prisma.session.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt } });
    return { token, expiresAt };
  }

  async deleteSession(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }

  async me(userId: string): Promise<Me> {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { student: { select: { userId: true } }, school: { select: { id: true } } },
    });
    const profileComplete = u.role === 'STUDENT' ? !!u.student : u.role === 'SCHOOL_COORDINATOR' ? !!u.school : true;
    return { id: u.id, email: u.email, name: u.name, role: u.role, profileComplete };
  }

  // ---- 6-digit email codes ----

  private hmac(code: string): string {
    return createHmac('sha256', process.env.CODE_SECRET!).update(code).digest('hex');
  }

  private async sendCode(email: string, purpose: CodePurpose, subject: string): Promise<void> {
    const where = { email_purpose: { email, purpose } };
    const last = await this.prisma.emailCode.findUnique({ where });
    if (last && Date.now() - last.sentAt.getTime() < CODE_RESEND_MS) return; // stops inbox flooding

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const data = { codeHash: this.hmac(code), attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MS), sentAt: new Date() };
    await this.prisma.emailCode.upsert({ where, create: { email, purpose, ...data }, update: data });
    await this.mail.send({
      to: email,
      subject,
      text: `Your AVANTRA code is ${code}\n\nIt expires in 10 minutes. If you didn't ask for it, ignore this email.`,
    });
  }

  private async consumeCode(email: string, purpose: CodePurpose, code: string): Promise<boolean> {
    // Count the attempt first, atomically, so parallel guesses can't exceed the limit.
    const { count } = await this.prisma.emailCode.updateMany({
      where: { email, purpose, attempts: { lt: CODE_MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
      data: { attempts: { increment: 1 } },
    });
    if (!count) return false;

    const row = await this.prisma.emailCode.findUnique({ where: { email_purpose: { email, purpose } } });
    if (!row || !timingSafeEqual(Buffer.from(row.codeHash, 'hex'), Buffer.from(this.hmac(code), 'hex'))) return false;
    // Delete = use once. Only one of two parallel correct submissions wins.
    const used = await this.prisma.emailCode.deleteMany({ where: { id: row.id, codeHash: row.codeHash } });
    return used.count === 1;
  }
}
