import { Body, ConflictException, Controller, Get, HttpCode, Logger, NotFoundException, Param, Post, StreamableFile } from '@nestjs/common';
import {
  AssignJudgeRequest,
  AVANTRA_FEE_PAISE,
  CreateStaffRequest,
  MarkPaidRequest,
  SetRankRequest,
  UpiImportRequest,
  WalkInRequest,
} from '@avantra/shared';
import { Prisma, type User } from '@prisma/client';
import { hashPassword } from './auth/password';
import { CurrentUser, Roles } from './auth/session.guard';
import { isUniqueViolation, newStudentIds, retryOnIdClash } from './ids';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { feeConfirmedMail, upiFailedMail } from './registrations.controller';
import { readUpiSheet, writeUpiSheet } from './upi-sheet';
import { ZodPipe } from './zod.pipe';

// Staff accounts stop working the day after the event unless the admin sets another date.
const STAFF_EXPIRES = new Date('2026-12-21T23:59:59+05:30');
const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  expiresAt: true,
  disabledAt: true,
  createdAt: true,
  assignedEvent: { select: { id: true, name: true } },
};

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ---- referral codes: how many students signed up with each code, and how many of those paid ----
  // Codes are handed out by hand (Google Form + mail), so any code students typed shows up here, typos included.

  @Get('referrals')
  async referrals() {
    const [signups, paid] = await Promise.all([
      this.prisma.student.groupBy({ by: ['referralCode'], where: { referralCode: { not: null } }, _count: true, orderBy: { _count: { referralCode: 'desc' } } }),
      this.prisma.student.groupBy({ by: ['referralCode'], where: { referralCode: { not: null }, feePaidAt: { not: null } }, _count: true }),
    ]);
    const paidBy = new Map(paid.map((p) => [p.referralCode, p._count]));
    return signups.map((s) => ({ code: s.referralCode!, signups: s._count, paid: paidBy.get(s.referralCode) ?? 0 }));
  }

  // ---- UPI payments: the school checks them against its bank statement in Excel ----
  // Export = every UPI payment still waiting. The school marks each Paid / Not paid (or leaves it for later)
  // and sends the file back; import applies it. Decided payments never appear in an export again;
  // a student whose payment failed can send a new UTR, which joins the next export.

  private waitingUpi() {
    return this.prisma.payment.findMany({
      where: { method: 'UPI', status: 'CREATED' },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get('payments/upi')
  async upiWaiting() {
    return (await this.waitingUpi()).map((p) => ({ id: p.id, avantraId: p.student.avantraId, name: p.student.user.name, utr: p.utr, createdAt: p.createdAt }));
  }

  @Get('payments/upi.xlsx')
  async upiExport() {
    const rows = (await this.waitingUpi()).map((p) => ({
      avantraId: p.student.avantraId,
      name: p.student.user.name,
      school: p.student.schoolName,
      grade: p.student.grade,
      section: p.student.section,
      submittedAt: p.createdAt,
      utr: p.utr!,
      amountPaise: p.amountPaise,
    }));
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 2026-12-01
    return new StreamableFile(await writeUpiSheet(rows), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="avantra-upi-payments-${day}.xlsx"`,
    });
  }

  // Safe to import the same file twice: payments already decided are counted, not changed.
  @Post('payments/upi/import') @HttpCode(200)
  async upiImport(@CurrentUser() admin: User, @Body(new ZodPipe(UpiImportRequest)) { file }: UpiImportRequest) {
    const { decisions, unchecked, problems } = await readUpiSheet(Buffer.from(file, 'base64'));
    let paid = 0;
    let failed = 0;
    let already = 0;
    for (const d of decisions) {
      const payment = await this.prisma.payment.findFirst({
        where: { method: 'UPI', utr: d.utr, student: { avantraId: d.avantraId } },
        orderBy: { createdAt: 'desc' },
        include: { student: { include: { user: true } } },
      });
      if (!payment) {
        problems.push(`Row ${d.row}: no UPI payment with UTR ${d.utr} from ${d.avantraId}.`);
        continue;
      }
      const { student } = payment;
      // updateMany on status CREATED: two admins importing at once can't both apply the same row.
      const decide = { where: { id: payment.id, status: 'CREATED' as const }, data: { status: d.status, recordedById: admin.id } };
      if (d.status === 'FAILED') {
        if (!(await this.prisma.payment.updateMany(decide)).count) {
          already++;
          continue;
        }
        failed++;
        await this.mail.send(upiFailedMail(student.user.email, student.avantraId, d.utr));
        continue;
      }
      const applied = await this.prisma.$transaction(async (tx) => {
        if (!(await tx.payment.updateMany(decide)).count) return false;
        await tx.student.update({ where: { userId: student.userId }, data: { feePaidAt: student.feePaidAt ?? new Date() } });
        return true;
      });
      if (!applied) {
        already++;
        continue;
      }
      paid++;
      if (student.feePaidAt) this.logger.error(`Student ${student.avantraId} paid twice (UPI ${d.utr}): refund one`);
      else await this.mail.send(feeConfirmedMail(student.user.email, student.avantraId, payment.amountPaise, `UPI ${d.utr}`));
    }
    return { paid, failed, already, unchecked, problems };
  }

  // ---- registration desk: cash fee and walk-ins ----

  // Cash fee for a student who signed up online. Records which admin took the money.
  @Post('students/:avantraId/mark-paid') @HttpCode(200)
  async markPaid(@CurrentUser() admin: User, @Param('avantraId') avantraId: string, @Body(new ZodPipe(MarkPaidRequest)) { note }: MarkPaidRequest) {
    const student = await this.prisma.student.findUnique({ where: { avantraId: avantraId.toUpperCase() }, include: { user: true } });
    if (!student) throw new NotFoundException('Unknown AVANTRA ID');
    await this.prisma.$transaction(async (tx) => {
      // Conditional update = only one of two admins clicking at once records the cash.
      const { count } = await tx.student.updateMany({ where: { userId: student.userId, feePaidAt: null }, data: { feePaidAt: new Date() } });
      if (!count) throw new ConflictException('Fee already paid');
      await tx.payment.create({
        data: { studentId: student.userId, amountPaise: AVANTRA_FEE_PAISE, method: 'OFFLINE', status: 'PAID', recordedById: admin.id, note },
      });
    });
    await this.mail.send(feeConfirmedMail(student.user.email, student.avantraId, AVANTRA_FEE_PAISE, note ?? 'cash at desk'));
    return { avantraId: student.avantraId, name: student.user.name, feePaid: true };
  }

  // Walk-in: account + profile + cash fee in one step. They set a password later via "Forgot password".
  @Post('walk-in')
  async walkIn(@CurrentUser() admin: User, @Body(new ZodPipe(WalkInRequest)) body: WalkInRequest) {
    const { name, email, phone, note, guardianConsent: _, ...profile } = body;
    try {
      const student = await retryOnIdClash(['avantraId', 'qrToken'], () =>
        this.prisma.student.create({
          data: {
            ...profile,
            ...newStudentIds(),
            guardianConsentAt: new Date(),
            feePaidAt: new Date(),
            user: { create: { name, email, phone, role: 'STUDENT' } },
            payments: { create: { amountPaise: AVANTRA_FEE_PAISE, method: 'OFFLINE', status: 'PAID', recordedById: admin.id, note } },
          },
        }),
      );
      await this.mail.send({
        ...feeConfirmedMail(email, student.avantraId, AVANTRA_FEE_PAISE, note ?? 'cash at desk'),
        text:
          `${name} is registered for AVANTRA 2026 and the Science Exhibition (paid ₹${AVANTRA_FEE_PAISE / 100} at the desk).
AVANTRA ID: ${student.avantraId}

` +
          `To log in, open the AVANTRA site, choose "Forgot password" and enter this email to set a password.`,
      });
      return { avantraId: student.avantraId, qrToken: student.qrToken, name };
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('An account with this email already exists. Use mark-paid with their AVANTRA ID.');
      throw e;
    }
  }

  // ---- results ----

  @Post('teams/:id/rank') @HttpCode(200)
  async setRank(@Param('id') id: string, @Body(new ZodPipe(SetRankRequest)) { rank }: SetRankRequest) {
    return this.prisma.team.update({ where: { id }, data: { rank }, select: { id: true, name: true, rank: true } }).catch(() => {
      throw new NotFoundException();
    });
  }

  // ---- volunteers and judges ----

  @Get('staff')
  staff() {
    return this.prisma.user.findMany({ where: { role: { in: ['VOLUNTEER', 'JUDGE'] } }, select: staffSelect, orderBy: { name: 'asc' } });
  }

  @Post('staff')
  async createStaff(@Body(new ZodPipe(CreateStaffRequest)) { password, expiresAt, eventId, ...rest }: CreateStaffRequest) {
    if (eventId && !(await this.prisma.event.findUnique({ where: { id: eventId } }))) throw new NotFoundException('Event not found');
    try {
      return await this.prisma.user.create({
        data: {
          ...rest,
          assignedEventId: rest.role === 'JUDGE' ? eventId : null,
          passwordHash: await hashPassword(password),
          expiresAt: expiresAt ?? STAFF_EXPIRES,
          emailVerifiedAt: new Date(),
        },
        select: staffSelect,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Email already in use');
      throw e;
    }
  }

  // Move a judge to another event.
  @Post('staff/:id/assign') @HttpCode(200)
  async assignJudge(@Param('id') id: string, @Body(new ZodPipe(AssignJudgeRequest)) { eventId }: AssignJudgeRequest) {
    const judge = await this.prisma.user.findUnique({ where: { id } });
    if (judge?.role !== 'JUDGE') throw new NotFoundException('Judge not found');
    if (!(await this.prisma.event.findUnique({ where: { id: eventId } }))) throw new NotFoundException('Event not found');
    return this.prisma.user.update({ where: { id }, data: { assignedEventId: eventId }, select: staffSelect });
  }

  // Switch off any non-admin account and log it out everywhere.
  @Post('users/:id/disable') @HttpCode(200)
  async disable(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role === 'ADMIN') throw new NotFoundException();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { disabledAt: new Date() } }),
      this.prisma.session.deleteMany({ where: { userId: id } }),
    ]);
    return { id, disabled: true };
  }

  @Post('users/:id/enable') @HttpCode(200)
  async enable(@Param('id') id: string) {
    await this.prisma.user.update({ where: { id }, data: { disabledAt: null } }).catch(() => {
      throw new NotFoundException();
    });
    return { id, disabled: false };
  }
}
