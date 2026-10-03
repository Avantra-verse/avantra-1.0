import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AdminVerifyRequest,
  ForgotPasswordRequest,
  GoogleLoginRequest,
  LoginRequest,
  type Me,
  PasswordLoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@avantra/shared';
import type { User } from '@prisma/client';
import type { Request, Response } from 'express';
import { ZodPipe } from '../zod.pipe';
import { AuthService } from './auth.service';
import { CurrentUser, Public, readCookie, SESSION_COOKIE } from './session.guard';

const perMinute = (limit: number) => Throttle({ default: { limit, ttl: 60_000 } });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('register') @HttpCode(202) @perMinute(5)
  async register(@Body(new ZodPipe(RegisterRequest)) body: RegisterRequest) {
    await this.auth.requestSignupCode(body);
    return { message: 'If this email can be used, we sent a 6-digit code to it.' };
  }

  @Public() @Post('register/verify') @HttpCode(200) @perMinute(10)
  async verify(@Body(new ZodPipe(VerifyEmailRequest)) body: VerifyEmailRequest, @Res({ passthrough: true }) res: Response) {
    return this.startSession(res, await this.auth.verifySignup(body));
  }

  @Public() @Post('login') @HttpCode(200) @perMinute(10)
  async login(@Body(new ZodPipe(LoginRequest)) body: LoginRequest, @Res({ passthrough: true }) res: Response) {
    return this.startSession(res, await this.auth.login(body));
  }

  @Public() @Post('google') @HttpCode(200) @perMinute(10)
  async google(@Body(new ZodPipe(GoogleLoginRequest)) body: GoogleLoginRequest, @Res({ passthrough: true }) res: Response) {
    return this.startSession(res, await this.auth.loginWithGoogle(body));
  }

  @Public() @Post('staff/login') @HttpCode(200) @perMinute(10)
  async staffLogin(@Body(new ZodPipe(PasswordLoginRequest)) body: PasswordLoginRequest, @Res({ passthrough: true }) res: Response) {
    return this.startSession(res, await this.auth.staffLogin(body));
  }

  @Public() @Post('admin/login') @HttpCode(202) @perMinute(5)
  async adminLogin(@Body(new ZodPipe(PasswordLoginRequest)) body: PasswordLoginRequest) {
    await this.auth.adminLogin(body);
    return { message: 'We emailed you a 6-digit code.' };
  }

  @Public() @Post('admin/login/verify') @HttpCode(200) @perMinute(10)
  async adminVerify(@Body(new ZodPipe(AdminVerifyRequest)) body: AdminVerifyRequest, @Res({ passthrough: true }) res: Response) {
    return this.startSession(res, await this.auth.adminVerify(body));
  }

  @Public() @Post('password/forgot') @HttpCode(202) @perMinute(5)
  async forgot(@Body(new ZodPipe(ForgotPasswordRequest)) body: ForgotPasswordRequest) {
    await this.auth.forgotPassword(body);
    return { message: 'If that email is registered, we sent a 6-digit code to it.' };
  }

  @Public() @Post('password/reset') @HttpCode(200) @perMinute(10)
  async reset(@Body(new ZodPipe(ResetPasswordRequest)) body: ResetPasswordRequest) {
    await this.auth.resetPassword(body);
    return { message: 'Password changed. Log in with your new password.' };
  }

  @Public() @Post('logout') @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) await this.auth.deleteSession(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  me(@CurrentUser() user: User): Promise<Me> {
    return this.auth.me(user.id);
  }

  private async startSession(res: Response, user: User): Promise<Me> {
    const { token, expiresAt } = await this.auth.createSession(user);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
    return this.auth.me(user.id);
  }
}
