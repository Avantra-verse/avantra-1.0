import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { StudentProfile } from '@avantra/shared';
import type { User } from '@prisma/client';
import { CurrentUser, Roles } from './auth/session.guard';
import { newStudentIds, retryOnIdClash } from './ids';
import { PrismaService } from './prisma.service';
import { ZodPipe } from './zod.pipe';

@Controller()
export class ProfileController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('profile')
  async profile(@CurrentUser() user: User) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        student: {
          include: {
            _count: { select: { checkIns: { where: { eventId: null } } } }, // days through the gate
            payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { method: true, status: true, utr: true, createdAt: true } }, // the latest, for "under review" / "failed"
          },
        },
      },
    });
  }

  @Roles('STUDENT') @Post('profile/student')
  async createStudent(@CurrentUser() user: User, @Body(new ZodPipe(StudentProfile)) body: StudentProfile) {
    const { phone, guardianConsent: _, ...rest } = body;
    if (await this.prisma.student.findUnique({ where: { userId: user.id } })) throw new ConflictException('Profile already exists');
    const updated = await retryOnIdClash(['avantraId', 'qrToken'], () =>
      this.prisma.user.update({
        where: { id: user.id },
        data: { phone, student: { create: { ...rest, guardianConsentAt: new Date(), ...newStudentIds() } } },
        select: { student: true },
      }),
    );
    return updated.student;
  }

}
