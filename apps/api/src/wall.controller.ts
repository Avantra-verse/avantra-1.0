// ARITHI Engagement Wall: students find chits around the venue, enter the chit's code and answer for points.
// Free for every student with a profile. Answers are checked automatically; wrong tries lock a challenge
// (3 for typed answers, 1 for multiple choice). The public leaderboard can be frozen for the final hour.
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  GoneException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  answerMatches,
  AvantraId,
  ChitCode,
  CreateWallChallengesRequest,
  UpdateWallChallengeRequest,
  wallAttempts,
  WallAnswerRequest,
  WallImportRequest,
  wallAnswersValid,
  WallStateRequest,
} from '@avantra/shared';
import type { User, WallChallenge } from '@prisma/client';
import { CurrentUser, Public, Roles } from './auth/session.guard';
import { renderChits } from './chits';
import { CsvFile, toCsv } from './csv';
import { isUniqueViolation, randomCode, retryOnIdClash } from './ids';
import { PrismaService } from './prisma.service';
import { readSheet, SHEET_COLUMNS, SHEET_EXAMPLES } from './wall-sheet';
import { ZodPipe } from './zod.pipe';

const OPEN_KEY = 'wall.open';
const FROZEN_KEY = 'wall.frozenAt'; // ISO time; absent = live

type Player = { studentId: string; name: string; grade: number; section: string | null; avantraId: string; schoolId: string | null; school: string | null; points: number; solved: number; lastSolvedAt: Date };
type SchoolRow = { schoolId: string; school: string; points: number; solved: number; players: number; lastSolvedAt: Date };

// Ranking: points, then more challenges solved, then whoever got there first.
const byRank = (a: { points: number; solved: number; lastSolvedAt: Date }, b: typeof a) =>
  b.points - a.points || b.solved - a.solved || a.lastSolvedAt.getTime() - b.lastSolvedAt.getTime();

// Public boards show "Aarav S.", never full names of minors.
const publicName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest.at(-1)![0].toUpperCase()}.` : first;
};

@Controller()
export class WallController {
  // ponytail: whole-board recompute, cached 5 s per API instance; the big screen and every phone share it.
  // Keyed by "live" or the freeze time.
  private boards = new Map<string, { at: number; players: Player[]; schools: SchoolRow[] }>();

  constructor(private readonly prisma: PrismaService) {}

  // ---- public: the big screen and the /wall page ----

  @Public() @Get('wall/leaderboard')
  async leaderboard() {
    const frozenAt = await this.frozenAt();
    const { players, schools } = await this.standings(frozenAt);
    return {
      open: await this.isOpen(),
      frozenAt, // set = standings at that moment; final results are revealed at the ceremony
      players: players.slice(0, 50).map((p, i) => ({ rank: i + 1, name: publicName(p.name), grade: p.grade, school: p.school, points: p.points, solved: p.solved })),
      schools: schools.map((s, i) => ({ rank: i + 1, name: s.school, points: s.points, solved: s.solved, players: s.players })),
    };
  }

  // ---- students ----

  // My score, ranks and solved chits: the achievement screen and the share card.
  @Roles('STUDENT') @Get('wall/me')
  async me(@CurrentUser() user: User) {
    await this.studentOf(user);
    const solves = await this.prisma.wallSolve.findMany({
      where: { studentId: user.id },
      include: { challenge: { select: { number: true, category: true, difficulty: true, points: true } } },
      orderBy: { solvedAt: 'desc' },
    });
    return { open: await this.isOpen(), ...(await this.standing(user.id)), solves: solves.map((s) => ({ ...s.challenge, solvedAt: s.solvedAt })) };
  }

  // Student types the code from a chit. Stricter limit so codes can't be guessed.
  @Roles('STUDENT') @Throttle({ default: { ttl: 60_000, limit: 30 } }) @Get('wall/challenges/:code')
  async challenge(@CurrentUser() user: User, @Param('code') code: string) {
    const c = await this.playable(user, code);
    return { ...this.view(c), ...(await this.progress(c, user.id)) };
  }

  @Roles('STUDENT') @Throttle({ default: { ttl: 60_000, limit: 30 } }) @Post('wall/challenges/:code/answer') @HttpCode(200)
  async answer(@CurrentUser() user: User, @Param('code') code: string, @Body(new ZodPipe(WallAnswerRequest)) { answer }: WallAnswerRequest) {
    const c = await this.playable(user, code);
    const correct = answerMatches(answer, c.answers);
    await this.prisma.$transaction(async (tx) => {
      // Lock the student so two quick taps can't get an extra try or score twice.
      await tx.$queryRaw`SELECT 1 FROM "Student" WHERE "userId" = ${user.id} FOR UPDATE`;
      const { status } = await this.progress(c, user.id, tx);
      if (status === 'SOLVED') throw new ConflictException('You already solved this one: find another chit');
      if (status === 'LOCKED') throw new ConflictException('No tries left on this challenge');
      await tx.wallAttempt.create({ data: { challengeId: c.id, studentId: user.id, answer, correct } });
      if (correct) await tx.wallSolve.create({ data: { challengeId: c.id, studentId: user.id } });
    });
    this.boards.clear();
    return {
      correct,
      pointsEarned: correct ? c.points : 0,
      ...(await this.progress(c, user.id)),
      me: await this.standing(user.id),
    };
  }

  // ---- admin ----

  @Roles('ADMIN') @Get('admin/wall')
  async adminList() {
    const [open, frozenAt, challenges] = await Promise.all([
      this.isOpen(),
      this.frozenAt(),
      this.prisma.wallChallenge.findMany({ include: { _count: { select: { solves: true, attempts: true } } }, orderBy: { number: 'asc' } }),
    ]);
    return { open, frozenAt, challenges };
  }

  // open: event-day on/off; closed = codes can't be opened or answered. The leaderboard stays public.
  // frozen: from now the public board and everyone's ranks stop moving; play goes on and points still count.
  // Unfreeze at the prize ceremony to reveal the final standings. Freezing twice keeps the first time.
  @Roles('ADMIN') @Put('admin/wall/state')
  async setState(@Body(new ZodPipe(WallStateRequest)) { open, frozen }: WallStateRequest) {
    const set = (key: string, value: string) => this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    if (open !== undefined) await set(OPEN_KEY, String(open));
    if (frozen === true && !(await this.frozenAt())) await set(FROZEN_KEY, new Date().toISOString());
    if (frozen === false) await this.prisma.setting.deleteMany({ where: { key: FROZEN_KEY } });
    this.boards.clear();
    return { open: await this.isOpen(), frozenAt: await this.frozenAt() };
  }

  // One or many challenges as JSON. Each gets a fresh chit code. All or nothing.
  @Roles('ADMIN') @Post('admin/wall/challenges')
  create(@Body(new ZodPipe(CreateWallChallengesRequest)) body: CreateWallChallengesRequest) {
    return this.insert(body);
  }

  // The spreadsheet admins fill in: header row + two examples (typed answer, multiple choice).
  @Roles('ADMIN') @Get('admin/wall/template.csv') @CsvFile('wall-template')
  template() {
    return toCsv(SHEET_COLUMNS, SHEET_EXAMPLES);
  }

  // Upload the filled sheet (saved as CSV). Any bad row = nothing added, with every problem listed by row number.
  @Roles('ADMIN') @Post('admin/wall/import')
  async import(@Body(new ZodPipe(WallImportRequest)) { csv }: WallImportRequest) {
    const { challenges, errors } = readSheet(csv);
    if (errors.length) throw new BadRequestException({ message: 'Fix these rows; nothing was added', errors });
    if (challenges.length > 500) throw new BadRequestException('At most 500 challenges per upload');
    return this.insert(challenges);
  }

  // Print-ready chits: 6 per A4 page, each with its own QR. ?numbers=4,9,12 reprints just those.
  @Roles('ADMIN') @Get('admin/wall/chits.pdf')
  async chitsPdf(@Query('numbers') numbers?: string) {
    const only = numbers?.split(',').map(Number).filter(Number.isInteger);
    const chits = await this.prisma.wallChallenge.findMany({ where: { active: true, number: only ? { in: only } : undefined }, orderBy: { number: 'asc' } });
    if (!chits.length) throw new NotFoundException('No active challenges to print');
    return new StreamableFile(Buffer.from(await renderChits(chits)), { type: 'application/pdf', disposition: 'attachment; filename="avantra-wall-chits.pdf"' });
  }

  private async insert(body: CreateWallChallengesRequest) {
    const numbers = body.map((c) => c.number);
    if (new Set(numbers).size !== numbers.length) throw new BadRequestException('Challenge numbers repeat in this list');
    const taken = await this.prisma.wallChallenge.findMany({ where: { number: { in: numbers } }, select: { number: true } });
    if (taken.length) throw new ConflictException(`Challenge numbers already used: ${taken.map((t) => t.number).join(', ')}`);
    const codes = new Set((await this.prisma.wallChallenge.findMany({ select: { code: true } })).map((c) => c.code));
    const data = body.map((c) => {
      let code: string;
      do code = randomCode(6);
      while (codes.has(code));
      codes.add(code);
      return { ...c, code, points: c.points ?? 10 * c.difficulty, options: c.options ?? [] };
    });
    try {
      return await this.prisma.wallChallenge.createManyAndReturn({ data });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Someone added challenges at the same time: try again');
      throw e;
    }
  }

  // Edit text, points, answers or deactivate. Adding an accepted answer re-checks earlier wrong tries,
  // so students who typed it get their points automatically.
  @Roles('ADMIN') @Patch('admin/wall/challenges/:id')
  async update(@Param('id') id: string, @Body(new ZodPipe(UpdateWallChallengeRequest)) body: UpdateWallChallengeRequest) {
    const current = await this.prisma.wallChallenge.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (!wallAnswersValid({ options: body.options ?? current.options, answers: body.answers ?? current.answers })) {
      throw new BadRequestException('Multiple choice needs 2+ options, and each answer must be one of them');
    }
    try {
      const challenge = await this.prisma.wallChallenge.update({ where: { id }, data: body });
      const regraded = body.answers ? await this.regrade(challenge) : 0;
      this.boards.clear();
      return { challenge, regraded };
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Another challenge has this number');
      throw e;
    }
  }

  // Lost or damaged chit: print a new one. The old code stops working; points already earned stay.
  @Roles('ADMIN') @Post('admin/wall/challenges/:id/new-code')
  async newCode(@Param('id') id: string) {
    if (!(await this.prisma.wallChallenge.findUnique({ where: { id } }))) throw new NotFoundException();
    return retryOnIdClash(['code'], () => this.prisma.wallChallenge.update({ where: { id }, data: { code: randomCode(6) } }));
  }

  // Disputes: wipe one student's tries (and points) on one challenge, so they get fresh tries.
  @Roles('ADMIN') @Delete('admin/wall/challenges/:id/students/:avantraId') @HttpCode(204)
  async reset(@Param('id') challengeId: string, @Param('avantraId') rawId: string) {
    const avantraId = AvantraId.safeParse(rawId);
    const student = avantraId.success && (await this.prisma.student.findUnique({ where: { avantraId: avantraId.data } }));
    if (!student) throw new NotFoundException('Student not found');
    await this.prisma.$transaction([
      this.prisma.wallAttempt.deleteMany({ where: { challengeId, studentId: student.userId } }),
      this.prisma.wallSolve.deleteMany({ where: { challengeId, studentId: student.userId } }),
    ]);
    this.boards.clear();
  }

  // For printing chits (mail merge): one row per challenge, no answers.
  @Roles('ADMIN') @Get('admin/export/wall-chits.csv') @CsvFile('wall-chits')
  async chitsCsv() {
    const rows = await this.prisma.wallChallenge.findMany({ where: { active: true }, orderBy: { number: 'asc' } });
    return toCsv(
      ['number', 'code', 'category', 'difficulty', 'points', 'question', 'options'],
      rows.map((c) => ({ ...c, options: c.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('   ') })),
    );
  }

  // Full live standings with AVANTRA IDs, for prizes (ignores the freeze).
  @Roles('ADMIN') @Get('admin/export/wall.csv') @CsvFile('wall-leaderboard')
  async standingsCsv() {
    const { players } = await this.standings(null, true);
    return toCsv(
      ['rank', 'avantraId', 'name', 'grade', 'section', 'school', 'points', 'solved', 'lastSolvedAt'],
      players.map((p, i) => ({ rank: i + 1, ...p })),
    );
  }

  // ---- helpers ----

  private async isOpen() {
    return (await this.prisma.setting.findUnique({ where: { key: OPEN_KEY } }))?.value === 'true';
  }

  private async frozenAt(): Promise<Date | null> {
    const v = (await this.prisma.setting.findUnique({ where: { key: FROZEN_KEY } }))?.value;
    return v ? new Date(v) : null;
  }

  private async studentOf(user: User) {
    const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
    if (!student) throw new ForbiddenException('Complete your profile first');
    return student;
  }

  private async playable(user: User, rawCode: string) {
    await this.studentOf(user);
    if (!(await this.isOpen())) throw new ForbiddenException('The Engagement Wall is closed right now');
    const code = ChitCode.safeParse(rawCode);
    const c = code.success && (await this.prisma.wallChallenge.findUnique({ where: { code: code.data } }));
    if (!c) throw new NotFoundException('No challenge with this code. Check the chit and try again');
    if (!c.active) throw new GoneException('This chit is no longer active: find another one');
    return c;
  }

  // What a student sees: everything on the chit, never the answers.
  private view(c: WallChallenge) {
    return { number: c.number, category: c.category, difficulty: c.difficulty, points: c.points, question: c.question, options: c.options };
  }

  private async progress(c: WallChallenge, studentId: string, db: Pick<PrismaService, 'wallAttempt'> = this.prisma) {
    const attempts = await db.wallAttempt.findMany({ where: { challengeId: c.id, studentId }, select: { correct: true } });
    const wrong = attempts.filter((a) => !a.correct).length;
    const max = wallAttempts(c);
    const status = attempts.some((a) => a.correct) ? 'SOLVED' : wrong >= max ? 'LOCKED' : 'OPEN';
    return { status, attemptsLeft: status === 'OPEN' ? max - wrong : 0 };
  }

  private async regrade(c: WallChallenge) {
    const wrong = await this.prisma.wallAttempt.findMany({ where: { challengeId: c.id, correct: false }, orderBy: { createdAt: 'asc' } });
    const now = wrong.filter((a) => answerMatches(a.answer, c.answers));
    const solved = new Set((await this.prisma.wallSolve.findMany({ where: { challengeId: c.id }, select: { studentId: true } })).map((s) => s.studentId));
    const first = new Map<string, Date>();
    for (const a of now) if (!solved.has(a.studentId) && !first.has(a.studentId)) first.set(a.studentId, a.createdAt);
    await this.prisma.$transaction([
      this.prisma.wallAttempt.updateMany({ where: { id: { in: now.map((a) => a.id) } }, data: { correct: true } }),
      this.prisma.wallSolve.createMany({ data: [...first].map(([studentId, solvedAt]) => ({ challengeId: c.id, studentId, solvedAt })), skipDuplicates: true }),
    ]);
    return first.size;
  }

  // A student always sees their own points live. While frozen, ranks (theirs and their school's) are as at the freeze.
  private async standing(studentId: string) {
    const frozenAt = await this.frozenAt();
    const me = (await this.standings()).players.find((p) => p.studentId === studentId);
    const { players, schools } = await this.standings(frozenAt);
    const i = players.findIndex((p) => p.studentId === studentId);
    const s = me?.schoolId ? schools.findIndex((x) => x.schoolId === me.schoolId) : -1;
    return {
      points: me?.points ?? 0,
      solved: me?.solved ?? 0,
      rank: i >= 0 ? i + 1 : null,
      players: players.length,
      school: s >= 0 ? { name: schools[s].school, rank: s + 1, points: schools[s].points } : null,
      frozenAt,
    };
  }

  // Disabled accounts don't rank. "Others" students rank individually but not for a school until an admin links them.
  private async standings(asOf: Date | null = null, fresh = false) {
    const key = asOf?.toISOString() ?? 'live';
    const cached = this.boards.get(key);
    if (!fresh && cached && Date.now() - cached.at < 5_000) return cached;
    const upTo = asOf?.toISOString() ?? '9999-12-31T00:00:00Z'; // solvedAt is stored as UTC
    const players = await this.prisma.$queryRaw<Player[]>`
      SELECT s."userId" AS "studentId", u.name, s.grade, s.section, s."avantraId", s."schoolId", COALESCE(sc.name, s."otherSchoolName") AS school,
             SUM(c.points)::int AS points, COUNT(*)::int AS solved, MAX(w."solvedAt") AS "lastSolvedAt"
      FROM "WallSolve" w
      JOIN "WallChallenge" c ON c.id = w."challengeId"
      JOIN "Student" s ON s."userId" = w."studentId"
      JOIN "User" u ON u.id = s."userId"
      LEFT JOIN "School" sc ON sc.id = s."schoolId"
      WHERE u."disabledAt" IS NULL AND w."solvedAt" <= (${upTo}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY s."userId", u.name, sc.name`;
    players.sort(byRank);
    const bySchool = new Map<string, SchoolRow>();
    for (const p of players) {
      if (!p.schoolId) continue;
      const row = bySchool.get(p.schoolId) ?? { schoolId: p.schoolId, school: p.school!, points: 0, solved: 0, players: 0, lastSolvedAt: p.lastSolvedAt };
      row.points += p.points;
      row.solved += p.solved;
      row.players += 1;
      if (p.lastSolvedAt > row.lastSolvedAt) row.lastSolvedAt = p.lastSolvedAt;
      bySchool.set(p.schoolId, row);
    }
    const board = { at: Date.now(), players, schools: [...bySchool.values()].sort(byRank) };
    this.boards.set(key, board);
    return board;
  }
}
