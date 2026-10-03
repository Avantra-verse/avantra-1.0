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
import { CreateRegistrationRequest, VerifyPaymentRequest } from '@avantra/shared';
import type { Event, Prisma, User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser, Public, Roles } from './auth/session.guard';
import { isUniqueViolation } from './ids';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { createOrder, hmacMatches, razorpayConfigured } from './razorpay';
import { createSoloTeamIfNeeded, teamInclude } from './teams.controller';
import { ZodPipe } from './zod.pipe';

// An unpaid registration holds its spot this long, then stops counting toward capacity.
const UNPAID_HOLD_MS = 30 * 60_000;

// Registrations that use up a spot: paid/free ones, plus unpaid ones still inside the hold.
export const activeRegistrations = (): Prisma.RegistrationWhereInput => ({
  OR: [{ status: 'CONFIRMED' }, { status: 'PENDING_PAYMENT', createdAt: { gt: new Date(Date.now() - UNPAID_HOLD_MS) } }],
});

@Controller()
export class RegistrationsController {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Roles('STUDENT') @Get('registrations/mine')
  mine(@CurrentUser() user: User) {
    return this.prisma.registration.findMany({
      where: { studentId: user.id },
      include: {
        event: { select: { id: true, slug: true, name: true, category: true, feePaise: true, teamMin: true, teamMax: true } },
        payments: { select: { status: true, amountPaise: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        teamMember: { select: { isLeader: true, team: { include: teamInclude } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles('STUDENT') @Post('registrations')
  async create(@CurrentUser() user: User, @Body(new ZodPipe(CreateRegistrationRequest)) { eventId }: CreateRegistrationRequest) {
    if (!(await this.prisma.student.findUnique({ where: { userId: user.id } }))) throw new ForbiddenException('Complete your profile first');

    return this.prisma.$transaction(async (tx) => {
      // Lock the event row so two people can't both take the last spot.
      const [event] = await tx.$queryRaw<Event[]>`SELECT * FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
      if (!event) throw new NotFoundException('Event not found');
      if (!event.registrationOpen) throw new BadRequestException('Registration for this event is closed');
      if (event.capacity !== null && (await tx.registration.count({ where: { eventId, ...activeRegistrations() } })) >= event.capacity) {
        throw new ConflictException('This event is full');
      }
      try {
        const reg = await tx.registration.create({
          data: { eventId, studentId: user.id, status: event.feePaise === 0 ? 'CONFIRMED' : 'PENDING_PAYMENT' },
        });
        if (reg.status === 'CONFIRMED') await createSoloTeamIfNeeded(tx, event, reg.id, user.name);
        return reg;
      } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictException('You are already registered for this event');
        throw e;
      }
    });
  }

  @Roles('STUDENT') @Delete('registrations/:id') @HttpCode(204)
  async cancel(@CurrentUser() user: User, @Param('id') id: string) {
    const reg = await this.myRegistration(user.id, id);
    if (reg.status !== 'PENDING_PAYMENT') throw new ConflictException('Paid registrations can only be cancelled by the organisers');
    await this.prisma.registration.delete({ where: { id } });
  }

  // Start (or retry) payment of the participant's own fee.
  @Roles('STUDENT') @Post('registrations/:id/pay')
  async pay(@CurrentUser() user: User, @Param('id') id: string) {
    if (!razorpayConfigured()) throw new ServiceUnavailableException('Payments are not set up yet');
    const reg = await this.myRegistration(user.id, id);
    if (reg.status !== 'PENDING_PAYMENT') throw new ConflictException('Nothing to pay');
    const amountPaise = reg.event.feePaise; // from the DB, never from the client
    const order = await createOrder(amountPaise, reg.id);
    await this.prisma.payment.create({ data: { registrationId: reg.id, amountPaise, razorpayOrderId: order.id } });
    // Everything Razorpay Checkout needs on the web page.
    return { keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: amountPaise, currency: 'INR', description: reg.event.name };
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
    const payment = await this.prisma.payment.findUnique({
      where: { razorpayOrderId: orderId },
      include: { registration: { include: { event: true, student: { include: { user: true } } } } },
    });
    // ponytail: money arrived for a cancelled/unknown order — logged for a manual refund rather than auto-refunded.
    if (!payment) return this.logger.error(`Paid order ${orderId} (payment ${paymentId}) has no registration: refund manually`);
    if (amountPaise !== undefined && amountPaise !== payment.amountPaise) {
      return this.logger.error(`Order ${orderId}: paid ${amountPaise}, expected ${payment.amountPaise}: check manually`);
    }
    if (payment.status === 'PAID') return; // webhook and browser both report the same payment

    const { registration: reg } = payment;
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', razorpayPaymentId: paymentId } });
      await tx.registration.update({ where: { id: reg.id }, data: { status: 'CONFIRMED' } });
      await createSoloTeamIfNeeded(tx, reg.event, reg.id, reg.student.user.name);
    });
    const teamHint = reg.event.teamMax > 1 ? '\nNext: create a team or join one with an invite code.' : '';
    await this.mail.send({
      to: reg.student.user.email,
      subject: `AVANTRA: ${reg.event.name} registration confirmed`,
      text: `Payment of ₹${payment.amountPaise / 100} received. You're registered for ${reg.event.name}.${teamHint}\nPayment ID: ${paymentId}`,
    });
  }

  private async myRegistration(userId: string, id: string) {
    const reg = await this.prisma.registration.findUnique({ where: { id }, include: { event: true } });
    if (!reg || reg.studentId !== userId) throw new NotFoundException();
    return reg;
  }
}
