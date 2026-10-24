import { z } from 'zod';
import { DatabaseService } from '../database/database.service';
import { UserRole } from '../generated/prisma/client';
import { hashPassword } from './password';
import { userIdentitySchema, newPasswordSchema, emailSchema } from './user-input';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';

const initialAdminSchema = userIdentitySchema.extend({ password: newPasswordSchema }).strict();
export class AdminSetupError extends Error {}

export class InitAdminService {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService = new AuditService(db)) {}

  async initialize(input: unknown): Promise<'created' | 'already-initialized'> {
    const parsed = initialAdminSchema.safeParse(input);
    if (!parsed.success) throw new AdminSetupError('Invalid admin input. Email/name required; password must contain 12–128 characters.');
    const { email, fullName, password } = parsed.data;
    const passwordHash = await hashPassword(password);
    return this.db.$transaction(async (tx) => {
      // Serialize bootstrap scripts so two operators cannot create different first admins.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(240024, 1)`;
      if (await tx.user.count({ where: { role: UserRole.ADMIN } })) return 'already-initialized';
      if (await tx.user.findUnique({ where: { email } })) throw new AdminSetupError('Email is already used; no account was modified.');
      const user = await tx.user.create({ data: { email, fullName, passwordHash, role: UserRole.ADMIN } });
      await this.audit.append({ actorKind: 'SYSTEM', action: AUDIT_ACTIONS.ADMIN_BOOTSTRAP,
        targetType: 'USER', targetId: user.id, metadata: { source: 'operator_cli' } }, tx);
      return 'created';
    });
  }

  async rotatePassword(input: unknown): Promise<void> {
    const parsed = z.object({ email: emailSchema, password: newPasswordSchema }).strict().safeParse(input);
    if (!parsed.success) throw new AdminSetupError('Invalid email or password policy.');
    const passwordHash = await hashPassword(parsed.data.password);
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(240024, 1)`;
      const user = await tx.user.findUnique({ where: { email: parsed.data.email } });
      if (!user || user.role !== UserRole.ADMIN) throw new AdminSetupError('Existing Admin required; no account was modified.');
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await this.audit.append({ actorKind: 'SYSTEM', action: AUDIT_ACTIONS.PASSWORD_ROTATED,
        targetType: 'USER', targetId: user.id, metadata: { source: 'operator_cli' } }, tx);
    });
  }
}
