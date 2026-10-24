import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type CommissionPolicy } from '../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';

function policyDto(policy: CommissionPolicy) {
  return { id: policy.id, employeeId: policy.employeeId, ratePercent: policy.ratePercent.toString(),
    previousRatePercent: policy.previousRatePercent?.toString() ?? null,
    effectiveAt: policy.effectiveAt.toISOString(), createdBy: policy.createdBy, createdAt: policy.createdAt.toISOString() };
}

@Injectable()
export class CommissionsRepository {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService) {}
  async lookupAt(employeeId: string, at: Date, tx: Prisma.TransactionClient = this.db) {
    const policy = await tx.commissionPolicy.findFirst({ where: { employeeId, effectiveAt: { lte: at } }, orderBy: { effectiveAt: 'desc' } });
    return policy ? policyDto(policy) : null;
  }
  private async requireStaff(id: string, tx: Prisma.TransactionClient) {
    const employee = await tx.user.findUnique({ where: { id }, select: { role: true } });
    if (!employee) throw new NotFoundException('Employee not found.');
    if (employee.role !== 'STAFF') throw new BadRequestException('Commission policies only support STAFF accounts.');
  }
  history(employeeId: string, page: number, pageSize: number) {
    return this.db.$transaction(async (tx) => {
      await this.requireStaff(employeeId, tx);
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now`;
      const current = await this.lookupAt(employeeId, now, tx);
      const total = await tx.commissionPolicy.count({ where: { employeeId } });
      const items = await tx.commissionPolicy.findMany({ where: { employeeId }, orderBy: { effectiveAt: 'desc' }, take: pageSize, skip: (page - 1) * pageSize });
      return { current, items: items.map(policyDto), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async create(employeeId: string, ratePercent: string, effectiveAt: Date | undefined, actorId: string) {
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${employeeId}::uuid FOR UPDATE`;
        await this.requireStaff(employeeId, tx);
        const at = effectiveAt ?? (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now;
        const previous = await this.lookupAt(employeeId, at, tx);
        const policy = await tx.commissionPolicy.create({ data: { employeeId, ratePercent, effectiveAt: at,
          previousRatePercent: previous?.ratePercent ?? null, createdBy: actorId } });
        const result = policyDto(policy);
        await this.audit.append({ actorKind: 'USER', actorId, action: AUDIT_ACTIONS.EMPLOYEE_COMMISSION_CHANGED,
          targetType: 'USER', targetId: employeeId, metadata: { source: 'api', policyId: policy.id,
            previousRatePercent: result.previousRatePercent, ratePercent: result.ratePercent, effectiveAt: result.effectiveAt } }, tx);
        return { ...result, above100Warning: policy.ratePercent.greaterThan(100) };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A policy already exists at this effective time.');
      throw error;
    }
  }
}
