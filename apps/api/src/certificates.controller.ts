import { Controller, Get, Header, HttpCode, NotFoundException, Param, Post, StreamableFile } from '@nestjs/common';
import { Public, Roles } from './auth/session.guard';
import { renderCertificate } from './certificate';
import { randomCode, retryOnIdClash } from './ids';
import { PrismaService } from './prisma.service';

const verifyUrl = (code: string) => `${process.env.WEB_ORIGIN}/verify/${code}`;

@Controller()
export class CertificatesController {
  constructor(private readonly prisma: PrismaService) {}

  // After the event: everyone registered for it who checked in (gate or desk, either day) gets a certificate.
  // Safe to run again, e.g. after setting winners' ranks: existing codes stay, new attendees are added.
  @Roles('ADMIN') @Post('admin/events/:id/certificates') @HttpCode(200)
  async issue(@Param('id') eventId: string) {
    if (!(await this.prisma.event.findUnique({ where: { id: eventId } }))) throw new NotFoundException();
    const attended = { student: { checkIns: { some: {} } } };
    const pending = await this.prisma.registration.findMany({ where: { eventId, certificateCode: null, ...attended }, select: { id: true } });
    for (const { id } of pending) {
      await retryOnIdClash(['certificateCode'], () =>
        this.prisma.registration.update({ where: { id }, data: { certificateCode: randomCode(10), certificateIssuedAt: new Date() } }),
      );
    }
    const [issued, notCheckedIn] = await Promise.all([
      this.prisma.registration.count({ where: { eventId, certificateCode: { not: null } } }),
      this.prisma.registration.count({ where: { eventId, student: { checkIns: { none: {} } } } }),
    ]);
    return { issuedNow: pending.length, issued, notCheckedIn };
  }

  // Public verify page data. The code is printed on the certificate; only what's on the certificate is shown.
  @Public() @Get('certificates/:code')
  async verify(@Param('code') code: string) {
    const c = await this.load(code);
    return { valid: true, ...c, verifyUrl: verifyUrl(c.code) };
  }

  @Public() @Get('certificates/:code/pdf') @Header('content-type', 'application/pdf')
  async pdf(@Param('code') code: string) {
    const c = await this.load(code);
    const bytes = await renderCertificate({ ...c, verifyUrl: verifyUrl(c.code) });
    return new StreamableFile(Buffer.from(bytes), { disposition: `inline; filename="AVANTRA-2026-${c.code}.pdf"` });
  }

  private async load(code: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { certificateCode: code.toUpperCase() },
      include: {
        event: { select: { name: true } },
        student: { include: { user: { select: { name: true } }, school: { select: { name: true } } } },
        teamMember: { select: { team: { select: { rank: true } } } },
      },
    });
    if (!reg?.certificateCode) throw new NotFoundException('No certificate with this ID');
    return {
      code: reg.certificateCode,
      name: reg.student.user.name,
      school: reg.student.school?.name ?? reg.student.otherSchoolName,
      event: reg.event.name,
      rank: reg.teamMember?.team.rank ?? null,
      issuedAt: reg.certificateIssuedAt,
    };
  }
}
