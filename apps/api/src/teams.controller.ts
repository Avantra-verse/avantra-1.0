import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateTeamRequest, JoinTeamRequest, UpdateTeamRequest } from '@avantra/shared';
import type { Event, Prisma, User } from '@prisma/client';
import { CurrentUser, Roles } from './auth/session.guard';
import { isUniqueViolation, randomCode } from './ids';
import { PrismaService } from './prisma.service';
import { ZodPipe } from './zod.pipe';

// ponytail: no retry on invite-code collision; 32^6 ≈ 1 billion codes, so ~1 in 300k at 3000 teams. User just retries.
const newInviteCode = () => randomCode(6);

export const teamInclude = {
  event: { select: { id: true, name: true, teamMin: true, teamMax: true } },
  members: {
    orderBy: { joinedAt: 'asc' },
    select: {
      registrationId: true,
      isLeader: true,
      joinedAt: true,
      registration: { select: { student: { select: { avantraId: true, user: { select: { name: true } } } } } },
    },
  },
} satisfies Prisma.TeamInclude;

// Solo events (team size 1): every confirmed participant gets a team of one, so judging always scores teams.
export async function createSoloTeamIfNeeded(tx: Prisma.TransactionClient, event: Event, registrationId: string, name: string) {
  if (event.teamMax !== 1) return;
  await tx.team.create({
    data: { eventId: event.id, name, inviteCode: newInviteCode(), members: { create: { registrationId, isLeader: true } } },
  });
}

@Roles('STUDENT')
@Controller('teams')
export class TeamsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body(new ZodPipe(CreateTeamRequest)) body: CreateTeamRequest) {
    const reg = await this.confirmedRegistration(user.id, body.eventId);
    if (reg.teamMember) throw new ConflictException('You are already in a team for this event');
    if (reg.event.teamMax === 1) throw new BadRequestException('This is a solo event');
    if (reg.event.category === 'EXHIBITION' && (!body.projectTitle || !body.topic)) {
      throw new BadRequestException('Project title and topic are required for the exhibition');
    }
    try {
      const team = await this.prisma.team.create({
        data: {
          eventId: body.eventId,
          name: body.name,
          projectTitle: body.projectTitle,
          topic: body.topic,
          inviteCode: newInviteCode(),
          members: { create: { registrationId: reg.id, isLeader: true } },
        },
        include: teamInclude,
      });
      return this.view(team);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('You are already in a team for this event');
      throw e;
    }
  }

  @Post('join') @HttpCode(200)
  async join(@CurrentUser() user: User, @Body(new ZodPipe(JoinTeamRequest)) { inviteCode }: JoinTeamRequest) {
    const team = await this.prisma.team.findUnique({ where: { inviteCode }, include: { event: true } });
    if (!team) throw new NotFoundException('No team with that invite code');
    const reg = await this.confirmedRegistration(user.id, team.eventId);
    if (reg.teamMember) {
      if (reg.teamMember.teamId === team.id) return this.get(user, team.id);
      throw new ConflictException('You are already in a team for this event. Leave it first.');
    }
    await this.prisma.$transaction(async (tx) => {
      // Lock the team so two people can't both take its last place.
      await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${team.id} FOR UPDATE`;
      await this.assertNotJudged(tx, team.id);
      if ((await tx.teamMember.count({ where: { teamId: team.id } })) >= team.event.teamMax) throw new ConflictException('This team is full');
      await tx.teamMember.create({ data: { teamId: team.id, registrationId: reg.id } });
    });
    return this.get(user, team.id);
  }

  @Get(':id')
  async get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.view(await this.memberTeam(user.id, id));
  }

  @Patch(':id')
  async update(@CurrentUser() user: User, @Param('id') id: string, @Body(new ZodPipe(UpdateTeamRequest)) body: UpdateTeamRequest) {
    await this.leaderTeam(user.id, id);
    return this.view(await this.prisma.team.update({ where: { id }, data: body, include: teamInclude }));
  }

  // Leaving: if the leader leaves, the longest-standing member takes over; the last one out deletes the team.
  @Post(':id/leave') @HttpCode(204)
  async leave(@CurrentUser() user: User, @Param('id') id: string) {
    const team = await this.memberTeam(user.id, id);
    if (team.event.teamMax === 1) throw new BadRequestException('Solo entries have no team to leave');
    const me = team.members.find((m) => m.registrationId === team.myRegistrationId)!;
    await this.prisma.$transaction(async (tx) => {
      await this.assertNotJudged(tx, id);
      await tx.teamMember.delete({ where: { registrationId: me.registrationId } });
      const next = team.members.find((m) => m.registrationId !== me.registrationId);
      if (!next) await tx.team.delete({ where: { id } });
      else if (me.isLeader) await tx.teamMember.update({ where: { registrationId: next.registrationId }, data: { isLeader: true } });
    });
  }

  @Delete(':id/members/:registrationId') @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string, @Param('registrationId') registrationId: string) {
    const team = await this.leaderTeam(user.id, id);
    const member = team.members.find((m) => m.registrationId === registrationId);
    if (!member) throw new NotFoundException('Not a member of this team');
    if (member.isLeader) throw new BadRequestException('Use leave to remove yourself');
    await this.prisma.$transaction(async (tx) => {
      await this.assertNotJudged(tx, id);
      await tx.teamMember.delete({ where: { registrationId } });
    });
  }

  // Old code stops working immediately.
  @Post(':id/invite-code') @HttpCode(200)
  async regenerateCode(@CurrentUser() user: User, @Param('id') id: string) {
    await this.leaderTeam(user.id, id);
    return this.view(await this.prisma.team.update({ where: { id }, data: { inviteCode: newInviteCode() }, include: teamInclude }));
  }

  // ---- helpers ----

  private view(team: Prisma.TeamGetPayload<{ include: typeof teamInclude }>) {
    const members = team.members.map((m) => ({
      registrationId: m.registrationId,
      isLeader: m.isLeader,
      joinedAt: m.joinedAt,
      name: m.registration.student.user.name,
      avantraId: m.registration.student.avantraId,
    }));
    return {
      id: team.id,
      name: team.name,
      inviteCode: team.inviteCode, // only ever returned to members
      projectTitle: team.projectTitle,
      topic: team.topic,
      event: team.event,
      members,
      complete: members.length >= team.event.teamMin,
      full: members.length >= team.event.teamMax,
    };
  }

  private async confirmedRegistration(userId: string, eventId: string) {
    const reg = await this.prisma.registration.findUnique({
      where: { eventId_studentId: { eventId, studentId: userId } },
      include: { event: true, teamMember: true },
    });
    if (reg?.status !== 'CONFIRMED') throw new ForbiddenException('Register (and pay, if the event has a fee) before joining a team');
    return reg;
  }

  private async memberTeam(userId: string, id: string) {
    const team = await this.prisma.team.findUnique({ where: { id }, include: teamInclude });
    const reg = team && (await this.prisma.registration.findUnique({ where: { eventId_studentId: { eventId: team.eventId, studentId: userId } } }));
    const mine = team?.members.find((m) => m.registrationId === reg?.id);
    if (!team || !mine) throw new NotFoundException();
    return { ...team, myRegistrationId: mine.registrationId, iAmLeader: mine.isLeader };
  }

  private async leaderTeam(userId: string, id: string) {
    const team = await this.memberTeam(userId, id);
    if (!team.iAmLeader) throw new ForbiddenException('Only the team leader can do this');
    return team;
  }

  // Once a judge has scored the team, its members are fixed.
  private async assertNotJudged(tx: Prisma.TransactionClient, teamId: string) {
    if (await tx.score.count({ where: { teamId } })) throw new ConflictException('Team members are locked after judging starts');
  }
}
