import { Body, ConflictException, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { SchoolProfile, StudentProfile } from '@avantra/shared';
import type { User } from '@prisma/client';
import { CurrentUser, Public, Roles } from './auth/session.guard';
import { isUniqueViolation, newStudentIds, retryOnIdClash } from './ids';
import { PrismaService } from './prisma.service';
import { ZodPipe } from './zod.pipe';

@Controller()
export class ProfileController {
  constructor(private readonly prisma: PrismaService) {}

  // School dropdown on the student profile step. School names are public.
  @Public() @Get('schools')
  schools() {
    return this.prisma.school.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, name: true, city: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get('profile')
  async profile(@CurrentUser() user: User) {
    const { student, school } = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        student: { include: { school: { select: { id: true, name: true, city: true } } } },
        school: { select: { id: true, name: true, city: true, address: true, status: true } },
      },
    });
    return { student, school };
  }

  @Roles('STUDENT') @Post('profile/student')
  async createStudent(@CurrentUser() user: User, @Body(new ZodPipe(StudentProfile)) body: StudentProfile) {
    const { phone, guardianConsent: _, schoolId, ...rest } = body;
    if (await this.prisma.student.findUnique({ where: { userId: user.id } })) throw new ConflictException('Profile already exists');
    if (schoolId && !(await this.prisma.school.findFirst({ where: { id: schoolId, status: 'APPROVED' } }))) {
      throw new ForbiddenException('Pick a school from the list');
    }
    const updated = await retryOnIdClash(['avantraId', 'qrToken'], () =>
      this.prisma.user.update({
        where: { id: user.id },
        data: { phone, student: { create: { ...rest, schoolId, guardianConsentAt: new Date(), ...newStudentIds() } } },
        select: { student: true },
      }),
    );
    return updated.student;
  }

  @Roles('SCHOOL_COORDINATOR') @Post('profile/school')
  async createSchool(@CurrentUser() user: User, @Body(new ZodPipe(SchoolProfile)) body: SchoolProfile) {
    const { phone, schoolName: name, ...rest } = body;
    if (await this.prisma.school.findUnique({ where: { coordinatorId: user.id } })) throw new ConflictException('You already registered a school');
    try {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { phone, school: { create: { name, ...rest } } }, // starts PENDING until an admin approves
        select: { school: true },
      });
      return updated.school;
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('This school is already registered');
      throw e;
    }
  }

  // Coordinators see only their own school's students. The filter is in the query, not the UI.
  @Roles('SCHOOL_COORDINATOR') @Get('coordinator/students')
  async myStudents(@CurrentUser() user: User) {
    const school = await this.prisma.school.findUnique({ where: { coordinatorId: user.id } });
    if (school?.status !== 'APPROVED') return [];
    return this.prisma.student.findMany({
      where: { schoolId: school.id },
      select: { avantraId: true, grade: true, feePaidAt: true, user: { select: { name: true, createdAt: true } } },
      orderBy: { user: { name: 'asc' } },
    });
  }
}
