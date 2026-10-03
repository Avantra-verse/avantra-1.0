import { Body, ConflictException, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { AssignJudgeRequest, CreateStaffRequest, LinkStudentRequest, SchoolStatus } from '@avantra/shared';
import { Prisma } from '@prisma/client';
import { hashPassword } from './auth/password';
import { Roles } from './auth/session.guard';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';
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
