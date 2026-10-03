import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { CreateEventRequest, UpdateEventRequest } from '@avantra/shared';
import { Prisma } from '@prisma/client';
import { Public, Roles } from './auth/session.guard';
import { PrismaService } from './prisma.service';
import { ZodPipe } from './zod.pipe';

@Controller()
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public() @Get('events')
  async list() {
    const events = await this.prisma.event.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    const taken = await this.prisma.registration.groupBy({ by: ['eventId'], _count: true });
    const count = new Map(taken.map((t) => [t.eventId, t._count]));
    return events.map((e) => ({ ...e, spotsLeft: e.capacity === null ? null : Math.max(0, e.capacity - (count.get(e.id) ?? 0)) }));
  }

  @Roles('ADMIN') @Post('admin/events')
  async create(@Body(new ZodPipe(CreateEventRequest)) body: CreateEventRequest) {
    return this.prisma.event.create({ data: body }).catch(slugTaken);
  }

  @Roles('ADMIN') @Patch('admin/events/:id')
  async update(@Param('id') id: string, @Body(new ZodPipe(UpdateEventRequest)) body: UpdateEventRequest) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException();
    if ((body.teamMin ?? event.teamMin) > (body.teamMax ?? event.teamMax)) throw new BadRequestException('teamMin must be ≤ teamMax');
    return this.prisma.event.update({ where: { id }, data: body }).catch(slugTaken);
  }
}

function slugTaken(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Slug already in use');
  throw e;
}
