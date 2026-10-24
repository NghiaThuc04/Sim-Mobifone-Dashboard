import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type EmployeeSalary } from '../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { EmployeesRepository } from '../employees/employees.repository';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import { monthBounds } from '../common/calendar';

const dto = (item: EmployeeSalary) => ({ id: item.id, employeeId: item.employeeId, amount: item.amount.toString(),
  previousAmount: item.previousAmount?.toString() ?? null, effectiveFrom: item.effectiveFrom.toISOString(),
  createdBy: item.createdBy, createdAt: item.createdAt.toISOString() });

@Injectable()
export class SalariesRepository {
  constructor(private readonly db: DatabaseService, private readonly employees: EmployeesRepository, private readonly audit: AuditService) {}
  async lookupAt(employeeId: string, at: Date, tx: Prisma.TransactionClient = this.db) {
    const item = await tx.employeeSalary.findFirst({ where: { employeeId, effectiveFrom: { lte: at } }, orderBy: { effectiveFrom: 'desc' } });
    return item ? dto(item) : null;
  }
  history(employeeId: string, month: string, page: number, pageSize: number) {
    const { from, until } = monthBounds(month);
    return this.db.$transaction(async (tx) => {
      await this.employees.requireStaff(employeeId, tx);
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now`;
      const current = await this.lookupAt(employeeId, now, tx);
      const opening = await this.lookupAt(employeeId, new Date(from.getTime() - 1), tx);
      const where = { employeeId, effectiveFrom: { gte: from, lt: until } };
      const total = await tx.employeeSalary.count({ where });
      const items = await tx.employeeSalary.findMany({ where, orderBy: { effectiveFrom: 'desc' }, take: pageSize, skip: (page - 1) * pageSize });
      return { current, opening, month, items: items.map(dto), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async create(employeeId: string, amount: string, effectiveFrom: Date | undefined, actorId: string) {
    try {
      return await this.db.$transaction(async (tx) => {
        await this.employees.lockStaff(tx, employeeId);
        const at = effectiveFrom ?? (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now;
        const previous = await this.lookupAt(employeeId, at, tx);
        const item = await tx.employeeSalary.create({ data: { employeeId, amount, previousAmount: previous?.amount ?? null,
          effectiveFrom: at, createdBy: actorId } });
        const result = dto(item);
        await this.audit.append({ actorKind: 'USER', actorId, action: AUDIT_ACTIONS.EMPLOYEE_SALARY_CHANGED,
          targetType: 'USER', targetId: employeeId, metadata: { source: 'api', salaryId: item.id, amount: result.amount,
            previousAmount: result.previousAmount, effectiveAt: result.effectiveFrom } }, tx);
        return result;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Salary already exists at this effective time.');
      throw error;
    }
  }
}
