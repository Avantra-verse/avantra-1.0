import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { CheckInRequest, JudgeLookupRequest, MAX_POINTS, SubmitScoresRequest } from '@avantra/shared';
import type { User } from '@prisma/client';
import { CurrentUser, Roles } from './auth/session.guard';
import { PrismaService } from './prisma.service';
import { teamInclude } from './teams.controller';
import { ZodPipe } from './zod.pipe';

// ponytail: "already checked in" = a scan in the last 12 h. Event days run 10:30–19:00, so day 2 never matches day 1.
const SAME_DAY_MS = 12 * 60 * 60_000;
const OFFLINE_MAX_AGE_MS = 48 * 60 * 60_000;

const studentCard = {
  avantraId: true,
  grade: true,
  feePaidAt: true,
  otherSchoolName: true,
  user: { select: { name: true } },
  school: { select: { name: true } },
} as const;

@Controller()
export class StaffController {
  constructor(private readonly prisma: PrismaService) {}

  // Gate (no eventId) or event desk. Returns who it is so the volunteer can match face to badge.
  @Roles('VOLUNTEER', 'JUDGE', 'ADMIN') @Post('staff/checkin') @HttpCode(200)
  async checkIn(@CurrentUser() staff: User, @Body(new ZodPipe(CheckInRequest)) body: CheckInRequest) {
    const now = Date.now();
    const at = body.scannedAt ?? new Date(now);
    if (at.getTime() > now + 60_000 || at.getTime() < now - OFFLINE_MAX_AGE_MS) throw new BadRequestException('Scan time is out of range');

    const student = await this.findStudent(body);
    const card = this.card(student);
    if (body.eventId) {
      const reg = await this.prisma.registration.findUnique({ where: { eventId_studentId: { eventId: body.eventId, studentId: student.userId } } });
      if (!reg) throw new ForbiddenException({ message: 'Not registered for this event', student: card });
    }

    const eventId = body.eventId ?? null;
    const earlier = await this.prisma.checkIn.findFirst({
      where: { studentId: student.userId, eventId, scannedAt: { gt: new Date(at.getTime() - SAME_DAY_MS), lte: new Date(at.getTime() + SAME_DAY_MS) } },
      orderBy: { scannedAt: 'asc' },
    });
    if (earlier) return { student: card, checkedInAt: earlier.scannedAt, alreadyCheckedIn: true };
    await this.prisma.checkIn.create({ data: { studentId: student.userId, eventId, scannedById: staff.id, scannedAt: at } });
    return { student: card, checkedInAt: at, alreadyCheckedIn: false };
  }

  // Judge's queue: every team in their event, and whether they've scored it yet.
  @Roles('JUDGE') @Get('staff/judge/teams')
  async judgeTeams(@CurrentUser() judge: User) {
    const event = await this.judgeEvent(judge);
    const teams = await this.prisma.team.findMany({
      where: { eventId: event.id },
      include: { ...teamInclude, scores: { where: { judgeId: judge.id }, select: { criterion: true, points: true } } },
      orderBy: { name: 'asc' },
    });
    return {
      event,
      teams: teams.map((t) => ({ id: t.id, name: t.name, projectTitle: t.projectTitle, topic: t.topic, members: t.members.length, scored: t.scores.length > 0 })),
    };
  }

  // Judge scans any member's QR (or types their AVANTRA ID) and gets that member's team in the judge's event.
  @Roles('JUDGE') @Post('staff/judge/lookup') @HttpCode(200)
  async judgeLookup(@CurrentUser() judge: User, @Body(new ZodPipe(JudgeLookupRequest)) body: JudgeLookupRequest) {
    const event = await this.judgeEvent(judge);
    const student = await this.findStudent(body);
    const reg = await this.prisma.registration.findUnique({
      where: { eventId_studentId: { eventId: event.id, studentId: student.userId } },
      include: { teamMember: true },
    });
    if (!reg) throw new NotFoundException({ message: `Not registered for ${event.name}`, student: this.card(student) });
    if (!reg.teamMember) throw new NotFoundException({ message: 'Registered, but not in a team yet', student: this.card(student) });
    return this.teamForJudge(judge.id, reg.teamMember.teamId, event);
  }

  @Roles('JUDGE') @Get('staff/judge/teams/:id')
  async judgeTeam(@CurrentUser() judge: User, @Param('id') id: string) {
    return this.teamForJudge(judge.id, id, await this.judgeEvent(judge));
  }

  // Upsert: a judge can correct their own scores. One row per team × judge × criterion.
  @Roles('JUDGE') @Post('staff/judge/scores') @HttpCode(200)
  async submitScores(@CurrentUser() judge: User, @Body(new ZodPipe(SubmitScoresRequest)) body: SubmitScoresRequest) {
    const event = await this.judgeEvent(judge);
    const team = await this.prisma.team.findUnique({ where: { id: body.teamId } });
    if (!team || team.eventId !== event.id) throw new NotFoundException('Team not in your event');
    const unknown = body.scores.filter((s) => !event.judgingCriteria.includes(s.criterion)).map((s) => s.criterion);
    if (unknown.length) throw new BadRequestException(`Unknown criteria: ${unknown.join(', ')}`);

    await this.prisma.$transaction(
      body.scores.map(({ criterion, points }) =>
        this.prisma.score.upsert({
          where: { teamId_judgeId_criterion: { teamId: team.id, judgeId: judge.id, criterion } },
          create: { teamId: team.id, judgeId: judge.id, criterion, points },
          update: { points },
        }),
      ),
    );
    return this.teamForJudge(judge.id, team.id, event);
  }

  // Ranking = average of each judge's total, so a team isn't helped or hurt by how many judges saw it.
  @Roles('ADMIN') @Get('admin/events/:id/leaderboard')
  async leaderboard(@Param('id') id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException();
    const teams = await this.prisma.team.findMany({ where: { eventId: id }, include: { ...teamInclude, scores: true } });
    const rows = teams.map((t) => {
      const perJudge = new Map<string, number>();
      for (const s of t.scores) perJudge.set(s.judgeId, (perJudge.get(s.judgeId) ?? 0) + s.points);
      const totals = [...perJudge.values()];
      return {
        teamId: t.id,
        name: t.name,
        projectTitle: t.projectTitle,
        members: t.members.map((m) => ({ name: m.registration.student.user.name, avantraId: m.registration.student.avantraId })),
        judges: totals.length,
        score: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 100) / 100 : null,
      };
    });
    rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return { event: { id: event.id, name: event.name, judgingCriteria: event.judgingCriteria, maxScore: event.judgingCriteria.length * MAX_POINTS }, teams: rows };
  }

  // ---- helpers ----

  private async findStudent(ref: { qrToken?: string; avantraId?: string }) {
    const student = await this.prisma.student.findUnique({
      where: ref.qrToken ? { qrToken: ref.qrToken } : { avantraId: ref.avantraId! },
      select: { userId: true, ...studentCard },
    });
    if (!student) throw new NotFoundException('Unknown badge');
    return student;
  }

  private card(s: { avantraId: string; grade: number; feePaidAt: Date | null; otherSchoolName: string | null; user: { name: string }; school: { name: string } | null }) {
    return { name: s.user.name, avantraId: s.avantraId, grade: s.grade, school: s.school?.name ?? s.otherSchoolName, feePaid: !!s.feePaidAt };
  }

  private async judgeEvent(judge: User) {
    const event = judge.assignedEventId ? await this.prisma.event.findUnique({ where: { id: judge.assignedEventId } }) : null;
    if (!event) throw new ForbiddenException('You are not assigned to an event yet');
    return event;
  }

  private async teamForJudge(judgeId: string, teamId: string, event: { id: string; name: string; judgingCriteria: string[] }) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { ...teamInclude, scores: { where: { judgeId }, select: { criterion: true, points: true } } },
    });
    if (!team || team.eventId !== event.id) throw new NotFoundException('Team not in your event');
    return {
      id: team.id,
      name: team.name,
      projectTitle: team.projectTitle,
      topic: team.topic,
      members: team.members.map((m) => ({ name: m.registration.student.user.name, avantraId: m.registration.student.avantraId })),
      criteria: event.judgingCriteria,
      maxPoints: MAX_POINTS,
      myScores: Object.fromEntries(team.scores.map((s) => [s.criterion, s.points])),
    };
  }
}
