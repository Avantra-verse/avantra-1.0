import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { createTransport, type Transporter } from 'nodemailer';

type Mail = { to: string; subject: string; text: string };

// Emails go through a BullMQ queue so requests return fast and failed sends retry.
@Injectable()
export class MailService {
  constructor(@InjectQueue('mail') private readonly queue: Queue<Mail>) {}

  send(mail: Mail) {
    return this.queue.add('send', mail, { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true });
  }
}

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger('Mail');
  // No SMTP_HOST (local dev) = print the email to the console instead of sending.
  private readonly smtp: Transporter | null = process.env.SMTP_HOST
    ? createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: Number(process.env.SMTP_PORT ?? 465) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : null;

  async process({ data }: Job<Mail>) {
    if (!this.smtp) {
      this.logger.log(`to ${data.to} | ${data.subject}\n${data.text}`);
      return;
    }
    await this.smtp.sendMail({ from: process.env.MAIL_FROM, ...data });
  }
}
