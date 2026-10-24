import { Body, Controller, ForbiddenException, Get, Header, HttpCode, Inject, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { APP_CONFIG, type ApiConfig } from '../config';
import { AuthService } from './auth.service';
import { readSessionCookie, sessionCookieName } from './session-token';
import { SessionService, type AuthenticatedRequest } from './session.service';
import { PublicAccess } from '../authorization/access.decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: ApiConfig) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthenticatedRequest) {
    if (!request.principal) throw new UnauthorizedException('Authentication required.');
    return { user: request.principal.user };
  }

  @Post('logout')
  @PublicAccess()
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    if (request.headers.origin !== this.config.FRONTEND_ORIGIN) throw new ForbiddenException('Origin not allowed.');
    await this.sessions.logout(request.headers.cookie);
    const production = this.config.NODE_ENV === 'production';
    response.clearCookie(sessionCookieName(production), { httpOnly: true, secure: production, sameSite: 'strict', path: '/' });
  }

  @Post('login')
  @PublicAccess()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(@Body() input: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    if (request.headers.origin !== this.config.FRONTEND_ORIGIN) throw new ForbiddenException('Origin not allowed.');
    if (!request.is('application/json')) throw new ForbiddenException('JSON request required.');
    const production = this.config.NODE_ENV === 'production';
    const name = sessionCookieName(production);
    const result = await this.auth.login(input, request.ip ?? request.socket.remoteAddress ?? 'unknown',
      readSessionCookie(request.headers.cookie, name));
    response.cookie(name, result.token, {
      httpOnly: true, secure: production, sameSite: 'strict', path: '/',
      maxAge: this.config.SESSION_TTL_SECONDS * 1000,
    });
    return { user: result.user, expiresAt: result.expiresAt.toISOString() };
  }
}
