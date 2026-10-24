import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma, UserStatus } from '../generated/prisma/client';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { Account, effectivePermissions } from '@sim-dashboard/shared';

const publicSelect = { id: true, email: true, fullName: true, role: true,
  permissions: { select: { permission: true, enabled: true } } } satisfies Prisma.UserSelect;
function accountFrom(user: Prisma.UserGetPayload<{ select: typeof publicSelect }>): Account {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role,
    permissions: effectivePermissions(user.role, user.permissions) };
}

@Injectable()
export class AuthRepository {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService = new AuditService(db)) {}

  findCredentials(email: string) {
    return this.db.user.findUnique({ where: { email },
      select: { id: true, passwordHash: true, status: true } });
  }

  async findSession(tokenHash: string) {
    const session = await this.db.authSession.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() }, user: { status: UserStatus.active } },
      select: { id: true, user: { select: publicSelect } },
    });
    return session ? { id: session.id, user: accountFrom(session.user) } : null;
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({ where: { tokenHash }, select: { id: true, userId: true } });
      if (!session) return;
      const removed = await tx.authSession.deleteMany({ where: { id: session.id } });
      if (removed.count) await this.audit.append({ actorKind: 'USER', actorId: session.userId,
        action: AUDIT_ACTIONS.LOGOUT, targetType: 'USER', targetId: session.userId, metadata: { source: 'api' } }, tx);
    });
  }

  async createSession(userId: string, verifiedHash: string, tokenHash: string, ttlSeconds: number, oldHash?: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: userId }, select: { ...publicSelect, status: true, passwordHash: true } });
      if (!current || current.status !== UserStatus.active || current.passwordHash !== verifiedHash) return null;
      if (oldHash) await tx.authSession.deleteMany({ where: { userId, tokenHash: oldHash } });
      await tx.authSession.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await tx.authSession.create({ data: { userId, tokenHash, expiresAt } });
      await this.audit.append({ actorKind: 'USER', actorId: userId, action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        targetType: 'USER', targetId: userId, metadata: { source: 'api' } }, tx);
      return { user: accountFrom(current), expiresAt };
    });
  }
}
