import { Body, ConflictException, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import {
  AssignJudgeRequest,
  AVANTRA_FEE_PAISE,
  CreateStaffRequest,
  LinkStudentRequest,
  MarkPaidRequest,
  SchoolStatus,
  SetRankRequest,
  WalkInRequest,
} from '@avantra/shared';
import { Prisma, type User } from '@prisma/client';
import { hashPassword } from './auth/password';
import { CurrentUser, Roles } from './auth/session.guard';
import { isUniqueViolation, newStudentIds, retryOnIdClash } from './ids';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { feeConfirmedMail } from './registrations.controller';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ---- schools ----

  @Get('schools')
  schools(@Query('status', new ZodPipe(SchoolStatus.optional())) status?: SchoolStatus) {
    return this.prisma.school.findMany({
      where: { status },
      include: {
        coordinator: { select: { name: true, email: true, phone: true } },
        _count: { select: { students: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('schools/:id/approve') @HttpCode(200)
  approve(@Param('id') id: string) {
    return this.setSchoolStatus(id, 'APPROVED');
  }

  @Post('schools/:id/reject') @HttpCode(200)
  reject(@Param('id') id: string) {
    return this.setSchoolStatus(id, 'REJECTED');
  }

  private async setSchoolStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    const school = await this.prisma.school
      .update({ where: { id }, data: { status }, include: { coordinator: { select: { email: true } } } })
      .catch(() => {
        throw new NotFoundException();
      });
    await this.mail.send({
      to: school.coordinator.email,
      subject: `AVANTRA: ${school.name} was ${status === 'APPROVED' ? 'approved' : 'not approved'}`,
      text:
        status === 'APPROVED'
          ? `${school.name} is now approved. Your students can pick it when they sign up, and you can see them in your dashboard.`
          : `${school.name} was not approved. Reply to this email if you think this is a mistake.`,
    });
    return school;
  }

  // ---- students who picked "Others" ----

  @Get('students/unlinked')
  unlinked() {
    return this.prisma.student.findMany({
      where: { schoolId: null },
      select: { userId: true, avantraId: true, otherSchoolName: true, grade: true, feePaidAt: true, user: { select: { name: true, email: true } } },
      orderBy: { otherSchoolName: 'asc' },
    });
  }

  @Post('students/:userId/link') @HttpCode(200)
  async link(@Param('userId') userId: string, @Body(new ZodPipe(LinkStudentRequest)) { schoolId }: LinkStudentRequest) {
    if (!(await this.prisma.school.findFirst({ where: { id: schoolId, status: 'APPROVED' } }))) throw new NotFoundException('School not found or not approved');
    return this.prisma.student
      .update({ where: { userId }, data: { schoolId, otherSchoolName: null }, select: { userId: true, avantraId: true, schoolId: true } })
      .catch(() => {
        throw new NotFoundException('Student not found');
      });
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
    const { name, email, phone, note, guardianConsent: _, schoolId, ...profile } = body;
    if (schoolId && !(await this.prisma.school.findFirst({ where: { id: schoolId, status: 'APPROVED' } }))) {
      throw new NotFoundException('School not found or not approved');
    }
    try {
      const student = await retryOnIdClash(['avantraId', 'qrToken'], () =>
        this.prisma.student.create({
          data: {
            ...profile,
            ...newStudentIds(),
            school: schoolId ? { connect: { id: schoolId } } : undefined,
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
          `${name} is registered for AVANTRA 2026 (paid ₹${AVANTRA_FEE_PAISE / 100} at the desk).
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
