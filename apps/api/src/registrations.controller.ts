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
import { type Event, Prisma, type User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser, Public, Roles } from './auth/session.guard';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { createOrder, hmacMatches, razorpayConfigured } from './razorpay';
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
      where: { members: { some: { studentId: user.id } } },
      include: {
        event: { select: { id: true, slug: true, name: true, category: true, feePaise: true } },
        members: { select: { isLeader: true, student: { select: { avantraId: true, user: { select: { name: true } } } } } },
        payments: { select: { status: true, amountPaise: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles('STUDENT') @Post('registrations')
  async create(@CurrentUser() user: User, @Body(new ZodPipe(CreateRegistrationRequest)) body: CreateRegistrationRequest) {
    const me = await this.prisma.student.findUnique({ where: { userId: user.id } });
    if (!me) throw new ForbiddenException('Complete your profile first');

    const otherIds = [...new Set(body.memberAvantraIds)].filter((id) => id !== me.avantraId);
    const others = await this.prisma.student.findMany({ where: { avantraId: { in: otherIds } }, select: { userId: true, avantraId: true } });
    const unknown = otherIds.filter((id) => !others.some((o) => o.avantraId === id));
    if (unknown.length) throw new BadRequestException(`Unknown AVANTRA ID: ${unknown.join(', ')}`);
    const studentIds = [me.userId, ...others.map((o) => o.userId)];

    return this.prisma.$transaction(async (tx) => {
      // Lock the event row so two last-spot registrations can't both get in.
      const [event] = await tx.$queryRaw<Event[]>`SELECT * FROM "Event" WHERE id = ${body.eventId} FOR UPDATE`;
      if (!event) throw new NotFoundException('Event not found');
      if (!event.registrationOpen) throw new BadRequestException('Registration for this event is closed');
      if (studentIds.length < event.teamMin || studentIds.length > event.teamMax) {
        throw new BadRequestException(`Team size must be ${event.teamMin}–${event.teamMax}`);
      }
      if (event.category === 'EXHIBITION' && (!body.projectTitle || !body.topic)) {
        throw new BadRequestException('Project title and topic are required for the exhibition');
      }
      if (event.capacity !== null && (await tx.registration.count({ where: { eventId: event.id, ...activeRegistrations() } })) >= event.capacity) {
        throw new ConflictException('This event is full');
      }
      try {
        return await tx.registration.create({
          data: {
            eventId: event.id,
            teamName: body.teamName,
            projectTitle: body.projectTitle,
            topic: body.topic,
            status: event.feePaise === 0 ? 'CONFIRMED' : 'PENDING_PAYMENT',
            members: { create: studentIds.map((studentId, i) => ({ studentId, eventId: event.id, isLeader: i === 0 })) },
          },
          include: { members: { select: { studentId: true, isLeader: true } } },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('You or a teammate are already registered for this event');
        }
        throw e;
      }
    });
  }

  // Leader cancels an unpaid registration (frees the spot and the members).
  @Roles('STUDENT') @Delete('registrations/:id') @HttpCode(204)
  async cancel(@CurrentUser() user: User, @Param('id') id: string) {
    const reg = await this.leaderRegistration(user.id, id);
    if (reg.status !== 'PENDING_PAYMENT') throw new ConflictException('Paid registrations can only be cancelled by the organisers');
    await this.prisma.registration.delete({ where: { id } });
  }

  // Leader starts (or retries) payment: a new Razorpay order for team size × fee.
  @Roles('STUDENT') @Post('registrations/:id/pay')
  async pay(@CurrentUser() user: User, @Param('id') id: string) {
    if (!razorpayConfigured()) throw new ServiceUnavailableException('Payments are not set up yet');
    const reg = await this.leaderRegistration(user.id, id);
    if (reg.status !== 'PENDING_PAYMENT') throw new ConflictException('Nothing to pay');
    const amountPaise = reg.event.feePaise * reg.members.length; // computed here, never taken from the client
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
      include: { registration: { include: { event: true, members: { where: { isLeader: true }, include: { student: { include: { user: true } } } } } } },
    });
    // ponytail: money arrived for a cancelled/unknown order — logged for a manual refund rather than auto-refunded.
    if (!payment) return this.logger.error(`Paid order ${orderId} (payment ${paymentId}) has no registration: refund manually`);
    if (amountPaise !== undefined && amountPaise !== payment.amountPaise) {
      return this.logger.error(`Order ${orderId}: paid ${amountPaise}, expected ${payment.amountPaise}: check manually`);
    }
    if (payment.status === 'PAID') return; // webhook and browser both report the same payment

    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID', razorpayPaymentId: paymentId } }),
      this.prisma.registration.update({ where: { id: payment.registrationId }, data: { status: 'CONFIRMED' } }),
    ]);
    const leader = payment.registration.members[0]?.student.user;
    if (leader) {
      await this.mail.send({
        to: leader.email,
        subject: `AVANTRA: ${payment.registration.event.name} registration confirmed`,
        text: `Payment of ₹${payment.amountPaise / 100} received. Your team is registered for ${payment.registration.event.name}.\nPayment ID: ${paymentId}`,
      });
    }
  }

  private async leaderRegistration(userId: string, id: string) {
    const reg = await this.prisma.registration.findUnique({ where: { id }, include: { event: true, members: true } });
    if (!reg || !reg.members.some((m) => m.studentId === userId && m.isLeader)) throw new NotFoundException();
    return reg;
  }
}
