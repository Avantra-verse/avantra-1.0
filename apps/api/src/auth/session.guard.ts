import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role, User } from '@prisma/client';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service';

export const SESSION_COOKIE = 'avantra_session';

// Routes need a session by default. Opt out with @Public(), narrow with @Roles(...).
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user as User);

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
}

export function isActive(user: Pick<User, 'disabledAt' | 'expiresAt'>): boolean {
  return !user.disabledAt && (!user.expiresAt || user.expiresAt > new Date());
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('public', targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = readCookie(req, SESSION_COOKIE);
    const session = token
      ? await this.prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } })
      : null;
    if (!session || session.expiresAt < new Date() || !isActive(session.user)) throw new UnauthorizedException();

    const roles = this.reflector.getAllAndOverride<Role[]>('roles', targets);
    if (roles && !roles.includes(session.user.role)) throw new ForbiddenException();

    req.user = session.user;
    return true;
  }
}
