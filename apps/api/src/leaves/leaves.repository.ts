import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { EmployeesRepository } from '../employees/employees.repository';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import type { LeaveInput } from './leaves.input';

@Injectable()
export class LeavesRepository {
  constructor(private readonly db: DatabaseService, private readonly employees: EmployeesRepository, private readonly audit: AuditService) {}
  async create(employeeId: string, input: LeaveInput, actorId: string) {
    try {
      return await this.db.$transaction(async (tx) => {
        await this.employees.lockStaff(tx, employeeId);
        const fromDate = new Date(input.fromDate + 'T00:00:00Z'); const toDate = new Date(input.toDate + 'T00:00:00Z');
        if (await tx.employeeLeaveRecord.findFirst({ where: { employeeId, fromDate: { lte: toDate }, toDate: { gte: fromDate } }, select: { id: true } })) throw new ConflictException('Leave period overlaps an existing record.');
        const item = await tx.employeeLeaveRecord.create({ data: { employeeId, fromDate, toDate, days: input.days,
          reason: input.reason, notes: input.notes, createdBy: actorId, allocations: { create: input.allocations.map((value) => ({ month: new Date(value.month + '-01T00:00:00Z'), days: value.days })) } }, select: { id: true } });
        await this.audit.append({ actorKind: 'USER', actorId, action: AUDIT_ACTIONS.EMPLOYEE_LEAVE_RECORDED,
          targetType: 'USER', targetId: employeeId, metadata: { source: 'api', leaveId: item.id, fromDate: input.fromDate,
            toDate: input.toDate, days: input.days, allocations: input.allocations } }, tx);
        return item;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Leave period overlaps an existing record.');
      throw error;
    }
  }
  list(employeeId: string, month: string, page: number, pageSize: number) {
    const at = new Date(month + '-01T00:00:00Z');
    return this.db.$transaction(async (tx) => {
      const where = { employeeId, allocations: { some: { month: at } } };
      const total = await tx.employeeLeaveRecord.count({ where });
      const aggregate = await tx.employeeLeaveAllocation.aggregate({ where: { month: at, record: { employeeId } }, _sum: { days: true } });
      const records = await tx.employeeLeaveRecord.findMany({ where, orderBy: [{ fromDate: 'desc' }, { id: 'asc' }], take: pageSize, skip: (page - 1) * pageSize,
        include: { allocations: { where: { month: at }, orderBy: { month: 'asc' } } } });
      const items = records.map((item) => ({ id: item.id, employeeId: item.employeeId, fromDate: item.fromDate.toISOString().slice(0,10),
        toDate: item.toDate.toISOString().slice(0,10), days: item.days.toString(), reason: item.reason, notes: item.notes,
        createdBy: item.createdBy, createdAt: item.createdAt.toISOString(), daysInMonth: item.allocations[0]?.days.toString() ?? '0' }));
      return { employeeId, month, items, totalDays: aggregate._sum.days?.toString() ?? '0', total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
