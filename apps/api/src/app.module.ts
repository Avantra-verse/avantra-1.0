import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { SessionGuard } from './auth/session.guard';
import { HealthController } from './health/health.controller';
import { MailProcessor, MailService } from './mail.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    // ponytail: in-memory rate limits, per API instance. Switch to Redis storage if we ever run 2+ instances.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL } }),
    BullModule.registerQueue({ name: 'mail' }),
  ],
  controllers: [HealthController, AuthController],
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
