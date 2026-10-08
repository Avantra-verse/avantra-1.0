import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './admin.controller';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { CertificatesController } from './certificates.controller';
import { EventsController } from './events.controller';
import { readCookie, SESSION_COOKIE, SessionGuard, sha256 } from './auth/session.guard';
import { HealthController } from './health/health.controller';
import { MailProcessor, MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { ProfileController } from './profile.controller';
import { RegistrationsController } from './registrations.controller';
import { ReportsController } from './reports.controller';
import { StaffController } from './staff.controller';
import { TeamsController } from './teams.controller';
import { WallController } from './wall.controller';

// Rate limits count per person, not per IP: at the venue hundreds of phones share one Wi-Fi IP, and mobile
// networks put many phones behind one IP too. Person = the session (logged in), else the email in a login or
// sign-up form, else the IP.
const person = (req: Record<string, any>): string => {
  const token = readCookie(req as never, SESSION_COOKIE);
  if (token) return `s:${sha256(token)}`;
  const email = req.body?.email;
  return typeof email === 'string' ? `e:${email.trim().toLowerCase()}` : req.ip;
};

@Module({
  imports: [
    // ponytail: in-memory rate limits, per API instance. Switch to Redis storage if we ever run 2+ instances.
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 120, getTracker: person },
        // Per IP: only tight on login/sign-up/reset (auth.controller), against one machine trying many emails.
        { name: 'ip', ttl: 60_000, limit: 100_000 },
      ],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL } }),
    BullModule.registerQueue({ name: 'mail' }),
  ],
  controllers: [HealthController, AuthController, ProfileController, AdminController, EventsController, RegistrationsController, TeamsController, StaffController, ReportsController, CertificatesController, WallController],
  providers: [
    PrismaService,
    AuthService,
    MailService,
    MailProcessor,
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // runs first
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
