import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { APP_CONFIG, type ApiConfig } from '../config';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class LoginLimiter {
  constructor(private readonly db: DatabaseService, @Inject(APP_CONFIG) private readonly config: ApiConfig) {}

  private async consume(scope: string, value: string, maximum: number): Promise<void> {
    const key = createHmac('sha256', this.config.SESSION_SECRET).update(`login:${scope}:${value}`).digest('hex');
    const windowMs = this.config.LOGIN_WINDOW_SECONDS * 1000;
    const [bucket] = await this.db.$queryRaw<{ attempts: number; expires_at: Date }[]>`
      INSERT INTO auth_login_limits (key, attempts, expires_at)
      VALUES (${key}, 1, NOW() + ${windowMs} * INTERVAL '1 millisecond')
      ON CONFLICT (key) DO UPDATE SET
        attempts = CASE WHEN auth_login_limits.expires_at <= NOW() THEN 1 ELSE LEAST(auth_login_limits.attempts + 1, 1000000) END,
        expires_at = CASE WHEN auth_login_limits.expires_at <= NOW() THEN EXCLUDED.expires_at ELSE auth_login_limits.expires_at END
      RETURNING attempts, expires_at`;
    if (bucket.attempts > maximum) {
      throw new HttpException({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too many login attempts. Try later.',
        retryAfter: Math.max(1, Math.ceil((bucket.expires_at.getTime() - Date.now()) / 1000)) }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async checkIp(ip: string): Promise<void> {
    await this.consume('ip', ip, this.config.LOGIN_IP_MAX);
    await this.db.$executeRaw`DELETE FROM auth_login_limits WHERE expires_at <= NOW() AND key IN
      (SELECT key FROM auth_login_limits WHERE expires_at <= NOW() LIMIT 100)`;
  }

  async checkAccount(email: string): Promise<void> {
    await this.consume('email', email, this.config.LOGIN_ACCOUNT_MAX);
  }
}
