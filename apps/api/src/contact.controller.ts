import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactRequest } from '@avantra/shared';
import { Public } from './auth/session.guard';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { ZodPipe } from './zod.pipe';

@Controller()
export class ContactController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // "Write to the team": emailed to CONTACT_TO, or to every active admin until that's set. Reply-to = the sender.
  @Public() @Post('contact') @HttpCode(202) @Throttle({ default: { limit: 3, ttl: 60_000 }, ip: { limit: 20, ttl: 60_000 } })
  async contact(@Body(new ZodPipe(ContactRequest)) { name, school, email, message, website }: ContactRequest) {
    if (website) return; // a bot filled the hidden field: pretend it worked
    const admins = process.env.CONTACT_TO ? [] : await this.prisma.user.findMany({ where: { role: 'ADMIN', disabledAt: null }, select: { email: true } });
    const to = process.env.CONTACT_TO || admins.map((u) => u.email).join(', ');
    if (!to) return;
    await this.mail.send({
      to,
      replyTo: email,
      subject: `AVANTRA website: message from ${name}`,
      text: `${name} <${email}>${school ? `\nSchool: ${school}` : ''}\n\n${message}\n\nReply to this email to answer them.`,
    });
  }
}
