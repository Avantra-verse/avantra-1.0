import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './admin.controller';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { EventsController } from './events.controller';
import { SessionGuard } from './auth/session.guard';
import { HealthController } from './health/health.controller';
import { MailProcessor, MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { ProfileController } from './profile.controller';
import { RegistrationsController } from './registrations.controller';

@Module({
  imports: [
    // ponytail: in-memory rate limits, per API instance. Switch to Redis storage if we ever run 2+ instances.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }], skipIf: () => process.env.NODE_ENV === 'test' }),
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL } }),
    BullModule.registerQueue({ name: 'mail' }),
  ],
  controllers: [HealthController, AuthController, ProfileController, AdminController, EventsController, RegistrationsController],
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
