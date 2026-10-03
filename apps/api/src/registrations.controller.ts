import type { RawBodyRequest } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AVANTRA_FEE_PAISE, CreateRegistrationRequest, VerifyPaymentRequest } from '@avantra/shared';
import type { Event, User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser, Public, Roles } from './auth/session.guard';
import { isUniqueViolation } from './ids';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { createOrder, hmacMatches, razorpayConfigured } from './razorpay';
import { createSoloTeamIfNeeded, teamInclude } from './teams.controller';
import { ZodPipe } from './zod.pipe';

// Same email for online (webhook) and cash (admin desk) payments.
export const feeConfirmedMail = (to: string, avantraId: string, amountPaise: number, reference: string) => ({
  to,
  subject: 'AVANTRA 2026: registration confirmed',
  text:
    `Payment of ₹${amountPaise / 100} received. You're an AVANTRA 2026 participant.
` +
    `Your AVANTRA ID: ${avantraId}

Next: register for events and form your teams.
Payment reference: ${reference}`,
});

@Controller()
export class RegistrationsController {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ---- AVANTRA fee: ₹199 once per student. Unpaid = not a participant. ----

  @Roles('STUDENT') @Post('payments/fee')
  async payFee(@CurrentUser() user: User) {
    if (!razorpayConfigured()) throw new ServiceUnavailableException('Payments are not set up yet');
    const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
    if (!student) throw new ForbiddenException('Complete your profile first');
    if (student.feePaidAt) throw new ConflictException('Registration fee already paid');
    const order = await createOrder(AVANTRA_FEE_PAISE, student.avantraId);
    await this.prisma.payment.create({ data: { studentId: user.id, amountPaise: AVANTRA_FEE_PAISE, razorpayOrderId: order.id } });
    // Everything Razorpay Checkout needs on the web page.
    return { keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: AVANTRA_FEE_PAISE, currency: 'INR', description: 'AVANTRA 2026 registration' };
  }

  // Fast path: the browser reports success. The webhook below confirms it independently.
  @Roles('STUDENT') @Post('payments/verify') @HttpCode(200)
  async verify(@Body(new ZodPipe(VerifyPaymentRequest)) body: VerifyPaymentRequest) {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
    if (!hmacMatches(process.env.RAZORPAY_KEY_SECRET ?? '', `${orderId}|${paymentId}`, signature)) {
      throw new BadRequestException('Payment could not be verified');
    }
    await this.markPaid(orderId, paymentId);
    return { ok: true };
  }

  // Source of truth. Razorpay retries until we return 2xx, so this must be idempotent.
  @Public() @SkipThrottle() @Post('payments/webhook') @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !req.rawBody || !signature || !hmacMatches(secret, req.rawBody, signature)) throw new BadRequestException('Bad signature');

    const { event, payload } = req.body as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string; amount: number } } } };
    const p = payload?.payment?.entity;
    if (!p?.order_id) return { ok: true }; // events we don't use
    if (event === 'payment.captured' || event === 'order.paid') await this.markPaid(p.order_id, p.id, p.amount);
    if (event === 'payment.failed') {
      await this.prisma.payment.updateMany({ where: { razorpayOrderId: p.order_id, status: 'CREATED' }, data: { status: 'FAILED' } });
    }
    return { ok: true };
  }

  private async markPaid(orderId: string, paymentId: string, amountPaise?: number) {
    const payment = await this.prisma.payment.findUnique({ where: { razorpayOrderId: orderId }, include: { student: { include: { user: true } } } });
    if (!payment) return this.logger.error(`Paid order ${orderId} (payment ${paymentId}) is unknown: check in Razorpay and refund if needed`);
    if (amountPaise !== undefined && amountPaise !== payment.amountPaise) {
      return this.logger.error(`Order ${orderId}: paid ${amountPaise}, expected ${payment.amountPaise}: check manually`);
    }
    if (payment.status === 'PAID') return; // webhook and browser both report the same payment

    // ponytail: two separate orders both paid (two tabs) = double charge; logged for a manual refund.
    if (payment.student.feePaidAt) this.logger.error(`Student ${payment.student.avantraId} paid twice (order ${orderId}): refund one`);
    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID', razorpayPaymentId: paymentId } }),
      this.prisma.student.update({ where: { userId: payment.studentId }, data: { feePaidAt: payment.student.feePaidAt ?? new Date() } }),
    ]);
    if (payment.student.feePaidAt) return;
    await this.mail.send({
      to: payment.student.user.email,
      subject: 'AVANTRA 2026: registration confirmed',
      text:
        `Payment of ₹${payment.amountPaise / 100} received. You're an AVANTRA 2026 participant.\n` +
        `Your AVANTRA ID: ${payment.student.avantraId}\n\nNext: register for events and form your teams.\nPayment ID: ${paymentId}`,
    });
  }

  // ---- event entries: free, but only for students who paid the fee ----

  @Roles('STUDENT') @Get('registrations/mine')
  mine(@CurrentUser() user: User) {
    return this.prisma.registration.findMany({
      where: { studentId: user.id },
      include: {
        event: { select: { id: true, slug: true, name: true, category: true, teamMin: true, teamMax: true } },
        teamMember: { select: { isLeader: true, team: { include: teamInclude } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles('STUDENT') @Post('registrations')
  async create(@CurrentUser() user: User, @Body(new ZodPipe(CreateRegistrationRequest)) { eventId }: CreateRegistrationRequest) {
    const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
    if (!student?.feePaidAt) throw new ForbiddenException('Pay the AVANTRA registration fee first');

    return this.prisma.$transaction(async (tx) => {
      // Lock the event row so two people can't both take the last spot.
      const [event] = await tx.$queryRaw<Event[]>`SELECT * FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
      if (!event) throw new NotFoundException('Event not found');
      if (!event.registrationOpen) throw new BadRequestException('Registration for this event is closed');
      if (event.capacity !== null && (await tx.registration.count({ where: { eventId } })) >= event.capacity) {
        throw new ConflictException('This event is full');
      }
      try {
        const reg = await tx.registration.create({ data: { eventId, studentId: user.id } });
        await createSoloTeamIfNeeded(tx, event, reg.id, user.name);
        return reg;
      } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictException('You are already registered for this event');
        throw e;
      }
    });
  }

  // Withdraw from an event (the AVANTRA fee is not refunded here). Team events: leave the team first.
  @Roles('STUDENT') @Delete('registrations/:id') @HttpCode(204)
  async withdraw(@CurrentUser() user: User, @Param('id') id: string) {
    const reg = await this.prisma.registration.findUnique({ where: { id }, include: { event: true, teamMember: true } });
    if (!reg || reg.studentId !== user.id) throw new NotFoundException();
    const teamId = reg.teamMember?.teamId;
    if (teamId && reg.event.teamMax > 1) throw new ConflictException('Leave your team first');
    await this.prisma.$transaction(async (tx) => {
      if (teamId) {
        if (await tx.score.count({ where: { teamId } })) throw new ConflictException('Already judged');
        await tx.team.delete({ where: { id: teamId } }); // solo team of one
      }
      await tx.registration.delete({ where: { id } });
    });
  }
}
