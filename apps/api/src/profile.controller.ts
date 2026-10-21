import { BadRequestException, Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { AmbassadorProfile, StudentProfile } from '@avantra/shared';
import type { User } from '@prisma/client';
import { CurrentUser, Roles } from './auth/session.guard';
import { newStudentIds, randomCode, retryOnIdClash } from './ids';
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
        student: { include: { _count: { select: { checkIns: { where: { eventId: null } } } } } }, // days through the gate
        ambassador: true,
      },
    });
  }

  @Roles('STUDENT') @Post('profile/student')
  async createStudent(@CurrentUser() user: User, @Body(new ZodPipe(StudentProfile)) body: StudentProfile) {
    const { phone, guardianConsent: _, referralCode, ...rest } = body;
    if (await this.prisma.student.findUnique({ where: { userId: user.id } })) throw new ConflictException('Profile already exists');
    const referredBy = referralCode ? await this.prisma.ambassador.findUnique({ where: { code: referralCode } }) : null;
    if (referralCode && !referredBy) throw new BadRequestException({ message: 'No ambassador has this code', issues: [{ path: 'referralCode', message: 'No ambassador has this code' }] });
    const updated = await retryOnIdClash(['avantraId', 'qrToken'], () =>
      this.prisma.user.update({
        where: { id: user.id },
        data: { phone, student: { create: { ...rest, referredById: referredBy?.userId, guardianConsentAt: new Date(), ...newStudentIds() } } },
        select: { student: true },
      }),
    );
    return updated.student;
  }

  @Roles('AMBASSADOR') @Post('profile/ambassador')
  async createAmbassador(@CurrentUser() user: User, @Body(new ZodPipe(AmbassadorProfile)) { phone, schoolName }: AmbassadorProfile) {
    if (await this.prisma.ambassador.findUnique({ where: { userId: user.id } })) throw new ConflictException('Profile already exists');
    const updated = await retryOnIdClash(['code'], () =>
      this.prisma.user.update({
        where: { id: user.id },
        data: { phone, ambassador: { create: { schoolName, code: randomCode(6) } } },
        select: { ambassador: true },
      }),
    );
    return updated.ambassador;
  }

  // An ambassador sees only the friends who signed up with their code.
  @Roles('AMBASSADOR') @Get('ambassador/referrals')
  myReferrals(@CurrentUser() user: User) {
    return this.prisma.student.findMany({
      where: { referredById: user.id },
      select: { grade: true, schoolName: true, feePaidAt: true, user: { select: { name: true, createdAt: true } } },
      orderBy: { user: { createdAt: 'desc' } },
    });
  }
}
