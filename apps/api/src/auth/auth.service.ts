import { BadRequestException, HttpException, Inject, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { APP_CONFIG, type ApiConfig } from '../config';
import { UserStatus } from '../generated/prisma/client';
import { hashPassword, verifyPassword } from '../users/password';
import { emailSchema } from '../users/user-input';
import { AuthRepository } from './auth.repository';
import { LoginLimiter } from './login-limiter';
import { hashSessionToken } from './session-token';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';
  constructor(private readonly repository: AuthRepository, private readonly limiter: LoginLimiter,
    @Inject(APP_CONFIG) private readonly config: ApiConfig, private readonly audit: AuditService) {}

  async onModuleInit() { this.dummyHash = await hashPassword(randomBytes(32).toString('hex')); }

  async login(input: unknown, ip: string, oldToken?: string) {
    try { return await this.authenticate(input, ip, oldToken); }
    catch (error) {
      if (error instanceof HttpException && [400, 401, 429].includes(error.getStatus())) {
        const reason = error.getStatus() === 429 ? 'rate_limited' : error.getStatus() === 400 ? 'invalid_input' : 'invalid_credentials';
        await this.audit.append({ actorKind: 'ANONYMOUS', action: AUDIT_ACTIONS.LOGIN_FAILURE,
          targetType: 'AUTH', metadata: { source: 'api', reason } });
      }
      throw error;
    }
  }

  private async authenticate(input: unknown, ip: string, oldToken?: string) {
    await this.limiter.checkIp(ip);
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid login input.');
    const { email, password } = parsed.data;
    await this.limiter.checkAccount(email);
    const user = await this.repository.findCredentials(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? this.dummyHash);
    if (!user || !valid || user.status !== UserStatus.active) throw new UnauthorizedException('Invalid email or password.');
    const token = randomBytes(32).toString('base64url');
    const session = await this.repository.createSession(user.id, user.passwordHash,
      hashSessionToken(token, this.config.SESSION_SECRET), this.config.SESSION_TTL_SECONDS,
      oldToken ? hashSessionToken(oldToken, this.config.SESSION_SECRET) : undefined);
    if (!session) throw new UnauthorizedException('Invalid email or password.');
    return { ...session, token };
  }
}
