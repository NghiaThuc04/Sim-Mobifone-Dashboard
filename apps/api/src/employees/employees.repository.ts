import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { AuditService, AUDIT_ACTIONS } from '../audit/audit.service';
import type { EmployeesQuery } from './employees.query';
import type { Employee, UserStatus } from '@sim-dashboard/shared';
import { effectivePermissions, STAFF_PERMISSIONS, type EmployeePermission } from '@sim-dashboard/shared';

type EmployeeRow = Omit<Employee, 'createdAt'> & { createdAt: Date };

@Injectable()
export class EmployeesRepository {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService) {}
  async permissions(id: string) {
    await this.findStaff(id);
    const overrides = await this.db.employeePermission.findMany({ where: { userId: id }, select: { permission: true, enabled: true } });
    const enabled = effectivePermissions('STAFF', overrides);
    return { employeeId: id, permissions: STAFF_PERMISSIONS.map((permission) => ({ permission, enabled: enabled.includes(permission) })) };
  }
  setPermissions(id: string, permissions: EmployeePermission[], actorId: string) {
    return this.db.$transaction(async (tx) => {
      await this.lockStaff(tx, id);
      const previous = await tx.employeePermission.findMany({ where: { userId: id }, select: { permission: true, enabled: true } });
      for (const item of permissions) await tx.employeePermission.upsert({
        where: { userId_permission: { userId: id, permission: item.permission } },
        create: { userId: id, ...item, updatedBy: actorId }, update: { enabled: item.enabled, updatedBy: actorId },
      });
      await this.audit.append({ actorKind: 'USER', actorId, action: AUDIT_ACTIONS.EMPLOYEE_PERMISSIONS_CHANGED,
        targetType: 'USER', targetId: id, metadata: { source: 'api',
          previousPermissions: effectivePermissions('STAFF', previous),
          permissions: effectivePermissions('STAFF', permissions) } }, tx);
      return { employeeId: id, permissions };
    });
  }
  async requireStaff(id: string, tx: Prisma.TransactionClient = this.db) {
    const employee = await tx.user.findUnique({ where: { id },
      select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true } });
    if (!employee) throw new NotFoundException('Employee not found.');
    if (employee.role !== 'STAFF') throw new BadRequestException('This operation only supports STAFF accounts.');
    return employee;
  }
  async findStaff(id: string) {
    const employee = await this.requireStaff(id);
    const policy = await this.db.commissionPolicy.findFirst({ where: { employeeId: id, effectiveAt: { lte: new Date() } }, orderBy: { effectiveAt: 'desc' }, select: { ratePercent: true } });
    return { ...employee, commissionRatePercent: policy?.ratePercent.toString() ?? null };
  }
  resetPassword(id: string, passwordHash: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      await this.lockStaff(tx, id);
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.authSession.deleteMany({ where: { userId: id } });
      await this.audit.append({ actorKind: 'USER', actorId, action: AUDIT_ACTIONS.EMPLOYEE_PASSWORD_RESET,
        targetType: 'USER', targetId: id, metadata: { source: 'api' } }, tx);
    });
  }
  async lockStaff(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
    return this.requireStaff(id, tx);
  }
  setStatus(id: string, status: UserStatus, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const previous = await this.lockStaff(tx, id);
      if (status === 'locked') await tx.authSession.deleteMany({ where: { userId: id } });
      const employee = await tx.user.update({ where: { id }, data: { status }, select: { id: true, status: true } });
      if (previous.status !== status) await this.audit.append({ actorKind: 'USER', actorId,
        action: AUDIT_ACTIONS.EMPLOYEE_STATUS_CHANGED, targetType: 'USER', targetId: id,
        metadata: { previousStatus: previous.status, status, source: 'api' } }, tx);
      return employee;
    });
  }
  async create(input: { email: string; fullName: string; passwordHash: string }, actorId: string) {
    try {
      return await this.db.$transaction(async (tx) => {
        const employee = await tx.user.create({ data: { ...input, role: 'STAFF' },
          select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true } });
        await this.audit.append({ actorKind: 'USER', actorId, action: AUDIT_ACTIONS.EMPLOYEE_CREATED,
          targetType: 'USER', targetId: employee.id, metadata: { role: 'STAFF', source: 'api' } }, tx);
        return employee;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already exists.');
      }
      throw error;
    }
  }
  list(query: EmployeesQuery, actorId: string) {
    const filters: Prisma.Sql[] = [];
    if (query.role) filters.push(Prisma.sql`role = ${query.role}::"UserRole"`);
    if (query.status) filters.push(Prisma.sql`status = ${query.status}::"UserStatus"`);
    if (query.search) {
      const pattern = '%' + query.search.replace(/[\\%_]/g, '\\$&') + '%';
      // Explicit Unicode collation keeps Vietnamese case matching independent of the cluster's C locale.
      filters.push(Prisma.sql`(email COLLATE "pg_unicode_fast" ILIKE ${pattern} OR full_name COLLATE "pg_unicode_fast" ILIKE ${pattern})`);
    }
    const where = filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}` : Prisma.empty;
    return this.db.$transaction(async (tx) => {
      const [count] = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT count(*)::int AS total FROM users ${where}`);
      const total = count.total;
      const items = await tx.$queryRaw<EmployeeRow[]>(Prisma.sql`
        SELECT id, email, full_name AS "fullName", role::text, status::text, created_at AS "createdAt",
          current_policy.rate_percent::text AS "commissionRatePercent"
        FROM users LEFT JOIN LATERAL (
          SELECT rate_percent FROM commission_policies WHERE employee_id = users.id AND effective_at <= CURRENT_TIMESTAMP
          ORDER BY effective_at DESC LIMIT 1
        ) current_policy ON true
        ${where} ORDER BY created_at DESC, id ASC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
      await this.audit.append({ actorKind: 'USER', actorId, action: AUDIT_ACTIONS.EMPLOYEES_VIEWED,
        targetType: 'EMPLOYEES', metadata: { page: query.page, pageSize: query.pageSize, hasSearch: !!query.search,
          ...(query.role ? { role: query.role } : {}), ...(query.status ? { status: query.status } : {}) } }, tx);
      return { items: items.map((item) => ({ ...item, commissionRatePercent: item.commissionRatePercent === null ? null : new Prisma.Decimal(item.commissionRatePercent).toString() })),
        total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
