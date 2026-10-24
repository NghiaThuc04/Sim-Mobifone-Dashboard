import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type ApiConfig } from '../config';
import { AuthRepository } from './auth.repository';
import { hashSessionToken, readSessionCookie, sessionCookieName } from './session-token';

export type SessionPrincipal = NonNullable<Awaited<ReturnType<AuthRepository['findSession']>>>;
export type AuthenticatedRequest = Request & { principal?: SessionPrincipal };

@Injectable()
export class SessionService {
  constructor(private readonly repository: AuthRepository, @Inject(APP_CONFIG) private readonly config: ApiConfig) {}

  private token(cookie: string | undefined) {
    return readSessionCookie(cookie, sessionCookieName(this.config.NODE_ENV === 'production'));
  }

  async resolve(cookie: string | undefined): Promise<SessionPrincipal> {
    const token = this.token(cookie);
    const principal = token ? await this.repository.findSession(hashSessionToken(token, this.config.SESSION_SECRET)) : null;
    if (!principal) throw new UnauthorizedException('Authentication required.');
    return principal;
  }

  async logout(cookie: string | undefined): Promise<void> {
    const token = this.token(cookie);
    if (token) await this.repository.revokeSession(hashSessionToken(token, this.config.SESSION_SECRET));
  }
}
