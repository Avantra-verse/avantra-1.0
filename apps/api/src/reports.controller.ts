import { applyDecorators, Controller, Get, Header, Query } from '@nestjs/common';
import { Roles } from './auth/session.guard';
import { toCsv } from './csv';
import { PrismaService } from './prisma.service';

const CsvFile = (name: string) =>
  applyDecorators(Header('content-type', 'text/csv; charset=utf-8'), Header('content-disposition', `attachment; filename="avantra-${name}.csv"`));

@Roles('ADMIN')
@Controller('admin')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  // One call for the admin dashboard's numbers.
  @Get('stats')
  async stats() {
    const p = this.prisma;
    const [students, paid, unlinked, schools, revenue, events, regs, teams, checkIns, gateToday] = await Promise.all([
      p.student.count(),
      p.student.count({ where: { feePaidAt: { not: null } } }),
      p.student.count({ where: { schoolId: null } }),
      p.school.groupBy({ by: ['status'], _count: true }),
      p.payment.groupBy({ by: ['method'], where: { status: 'PAID' }, _sum: { amountPaise: true }, _count: true }),
      p.event.findMany({ select: { id: true, name: true, capacity: true }, orderBy: { name: 'asc' } }),
      p.registration.groupBy({ by: ['eventId'], _count: true }),
      p.team.groupBy({ by: ['eventId'], _count: true }),
      p.checkIn.groupBy({ by: ['eventId'], _count: { studentId: true } }),
      p.checkIn.findMany({ where: { eventId: null, scannedAt: { gte: startOfTodayIST() } }, distinct: ['studentId'], select: { studentId: true } }),
    ]);
    const byEvent = <T extends { eventId: string | null }>(rows: T[], f: (r: T) => number) => new Map(rows.map((r) => [r.eventId, f(r)]));
    const regCount = byEvent(regs, (r) => r._count);
    const teamCount = byEvent(teams, (r) => r._count);
    const scanCount = byEvent(checkIns, (r) => r._count.studentId);
    const money = (m: 'ONLINE' | 'OFFLINE') => revenue.find((r) => r.method === m);
    return {
      students: { total: students, paid, unpaid: students - paid, unlinkedSchool: unlinked },
      schools: Object.fromEntries(schools.map((s) => [s.status, s._count])),
      fees: {
        onlinePaise: money('ONLINE')?._sum.amountPaise ?? 0,
        onlineCount: money('ONLINE')?._count ?? 0,
        cashPaise: money('OFFLINE')?._sum.amountPaise ?? 0,
        cashCount: money('OFFLINE')?._count ?? 0,
      },
      gate: { checkedInToday: gateToday.length },
      events: events.map((e) => ({
        ...e,
        registrations: regCount.get(e.id) ?? 0,
        teams: teamCount.get(e.id) ?? 0,
        deskScans: scanCount.get(e.id) ?? 0,
      })),
    };
  }

  // ---- CSV exports (minors' data: admin only) ----

  @Get('export/students.csv') @CsvFile('students')
  async studentsCsv() {
    const rows = await this.prisma.student.findMany({
      include: { user: true, school: true, payments: { where: { status: 'PAID' }, take: 1 }, _count: { select: { checkIns: true } } },
      orderBy: { avantraId: 'asc' },
    });
    return toCsv(
      ['avantraId', 'name', 'email', 'phone', 'grade', 'school', 'guardianPhone', 'guardianEmail', 'feePaidAt', 'paidBy', 'paymentRef', 'checkIns', 'signedUpAt'],
      rows.map((s) => ({
        avantraId: s.avantraId,
        name: s.user.name,
        email: s.user.email,
        phone: s.user.phone,
        grade: s.grade,
        school: s.school?.name ?? `${s.otherSchoolName} (unlinked)`,
        guardianPhone: s.guardianPhone,
        guardianEmail: s.guardianEmail,
        feePaidAt: s.feePaidAt,
        paidBy: s.payments[0]?.method,
        paymentRef: s.payments[0]?.razorpayPaymentId ?? s.payments[0]?.note,
        checkIns: s._count.checkIns,
        signedUpAt: s.user.createdAt,
      })),
    );
  }

  @Get('export/registrations.csv') @CsvFile('registrations')
  async registrationsCsv(@Query('eventId') eventId?: string) {
    const rows = await this.prisma.registration.findMany({
      where: { eventId },
      include: {
        event: true,
        student: { include: { user: true, school: true } },
        teamMember: { include: { team: true } },
      },
      orderBy: [{ event: { name: 'asc' } }, { createdAt: 'asc' }],
    });
    return toCsv(
      ['event', 'avantraId', 'name', 'grade', 'school', 'team', 'teamLeader', 'projectTitle', 'topic', 'rank', 'certificateCode', 'registeredAt'],
      rows.map((r) => ({
        event: r.event.name,
        avantraId: r.student.avantraId,
        name: r.student.user.name,
        grade: r.student.grade,
        school: r.student.school?.name ?? r.student.otherSchoolName,
        team: r.teamMember?.team.name,
        teamLeader: r.teamMember?.isLeader,
        projectTitle: r.teamMember?.team.projectTitle,
        topic: r.teamMember?.team.topic,
        rank: r.teamMember?.team.rank,
        certificateCode: r.certificateCode,
        registeredAt: r.createdAt,
      })),
    );
  }

  // Reconciliation with Razorpay settlements and the cash box.
  @Get('export/payments.csv') @CsvFile('payments')
  async paymentsCsv() {
    const rows = await this.prisma.payment.findMany({ include: { student: { include: { user: true } } }, orderBy: { createdAt: 'asc' } });
    const admins = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: rows.flatMap((r) => (r.recordedById ? [r.recordedById] : [])) } } })).map((u) => [u.id, u.email]),
    );
    return toCsv(
      ['createdAt', 'avantraId', 'name', 'amountRupees', 'method', 'status', 'razorpayOrderId', 'razorpayPaymentId', 'cashTakenBy', 'note'],
      rows.map((p) => ({
        createdAt: p.createdAt,
        avantraId: p.student.avantraId,
        name: p.student.user.name,
        amountRupees: p.amountPaise / 100,
        method: p.method,
        status: p.status,
        razorpayOrderId: p.razorpayOrderId,
        razorpayPaymentId: p.razorpayPaymentId,
        cashTakenBy: p.recordedById ? admins.get(p.recordedById) : undefined,
        note: p.note,
      })),
    );
  }
}

// Midnight in India, as a UTC Date (IST = UTC+5:30, no daylight saving).
function startOfTodayIST(): Date {
  const IST_MS = 330 * 60_000;
  const d = new Date(Date.now() + IST_MS);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - IST_MS);
}
