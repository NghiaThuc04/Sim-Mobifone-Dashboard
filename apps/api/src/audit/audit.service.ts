import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PERMISSIONS } from '@sim-dashboard/shared';
import type { Prisma } from '../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import { simSnapshotSchema } from '../inventory/inventory.input';

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS', LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE', LOGOUT: 'AUTH_LOGOUT',
  ADMIN_BOOTSTRAP: 'ADMIN_BOOTSTRAP', PASSWORD_ROTATED: 'ADMIN_PASSWORD_ROTATED',
  ACCESS_DENIED: 'AUTHORIZATION_DENIED', EMPLOYEES_VIEWED: 'EMPLOYEES_LIST_VIEWED',
  EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
  EMPLOYEE_STATUS_CHANGED: 'EMPLOYEE_STATUS_CHANGED',
  EMPLOYEE_PASSWORD_RESET: 'EMPLOYEE_PASSWORD_RESET',
  EMPLOYEE_PERMISSIONS_CHANGED: 'EMPLOYEE_PERMISSIONS_CHANGED',
  EMPLOYEE_COMMISSION_CHANGED: 'EMPLOYEE_COMMISSION_CHANGED',
  EMPLOYEE_SALARY_CHANGED: 'EMPLOYEE_SALARY_CHANGED',
  EMPLOYEE_LEAVE_RECORDED: 'EMPLOYEE_LEAVE_RECORDED',
  CATALOG_CREATED:'CATALOG_CREATED',CATALOG_UPDATED:'CATALOG_UPDATED',CATALOG_DELETED:'CATALOG_DELETED',
  SIM_PRICE_CHECKED: 'SIM_PRICE_CHECKED',
  SIM_CREATED: 'SIM_CREATED',
  SIM_UPDATED: 'SIM_UPDATED',
  SIM_IMPORTED: 'SIM_IMPORTED',
  SIM_REMOVED: 'SIM_REMOVED',
  ORDER_CREATED: 'ORDER_CREATED', ORDER_CLAIMED: 'ORDER_CLAIMED', ORDER_ASSIGNED: 'ORDER_ASSIGNED', ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED', ORDER_COMPLETED: 'ORDER_COMPLETED',
} as const;
const eventSchema = z.object({
  actorId: z.uuid().nullable().default(null), actorKind: z.enum(['USER', 'SYSTEM', 'ANONYMOUS']),
  action: z.enum(Object.values(AUDIT_ACTIONS)), targetType: z.enum(['USER', 'AUTH', 'ACCESS', 'EMPLOYEES','CATALOG','SIM','SIM_IMPORT','ORDER']),
  targetId: z.uuid().nullable().default(null),
  metadata: z.object({
    source: z.enum(['api', 'operator_cli']).optional(),
    priceError: z.boolean().optional(),
    importSuccess:z.number().int().nonnegative().optional(),importFailed:z.number().int().nonnegative().optional(),importSkipped:z.number().int().nonnegative().optional(),
    simBefore: simSnapshotSchema.optional(),
    simAfter: simSnapshotSchema.optional(),
    removalId: z.uuid().optional(),
    removedAt: z.iso.datetime().optional(),
    orderPreviousStatus: z.enum(['PENDING','CONFIRMED','PROCESSING','COMPLETED','CANCELLED']).optional(),
    orderStatus: z.enum(['PENDING','CONFIRMED','PROCESSING','COMPLETED','CANCELLED']).optional(),
    statusHistoryId: z.uuid().optional(),
    previousStaffId: z.uuid().nullable().optional(), assignedStaffId: z.uuid().nullable().optional(),
    beneficiaryNeedsDecision: z.boolean().optional(),
    completedAt: z.iso.datetime().optional(), rateEmployeeId: z.uuid().nullable().optional(),
    ratePolicyId: z.uuid().nullable().optional(), rateSnapshot: z.string().max(80).nullable().optional(),
    beneficiaryState: z.enum(['RESOLVED','UNRESOLVED']).optional(),
    assignmentId: z.uuid().optional(),
    orderCode: z.string().min(1).max(64).optional(),
    simId: z.uuid().optional(),
    reservationId: z.uuid().optional(),
    reason: z.enum(['invalid_input', 'invalid_credentials', 'rate_limited', 'permission_denied']).optional(),
    permission: z.enum(Object.values(PERMISSIONS)).optional(),
    page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(),
    hasSearch: z.boolean().optional(), role: z.enum(['ADMIN', 'STAFF']).optional(), status: z.enum(['active', 'locked']).optional(),
    previousStatus: z.enum(['active', 'locked']).optional(),
    previousPermissions: z.array(z.enum(Object.values(PERMISSIONS))).max(32).optional(),
    permissions: z.array(z.enum(Object.values(PERMISSIONS))).max(32).optional(),
    policyId: z.uuid().optional(), ratePercent: z.string().max(80).optional(),
    previousRatePercent: z.string().max(80).nullable().optional(), effectiveAt: z.iso.datetime().optional(),
    salaryId: z.uuid().optional(), amount: z.string().max(80).optional(), previousAmount: z.string().max(80).nullable().optional(),
    leaveId: z.uuid().optional(), fromDate: z.iso.date().optional(), toDate: z.iso.date().optional(), days: z.string().max(80).optional(),
    allocations: z.array(z.object({ month: z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/), days: z.string().max(80) }).strict()).max(120).optional(),
    catalogKind:z.enum(['carriers','sim-categories']).optional(),
    catalog:z.object({code:z.string().max(80),name:z.string().max(150)}).strict().optional(),
    previousCatalog:z.object({code:z.string().max(80),name:z.string().max(150)}).strict().optional(),
  }).strict().default({}),
}).strict().refine((event) => (event.actorKind === 'USER') === (event.actorId !== null));
export type AuditEvent = z.input<typeof eventSchema>;

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}
  append(event: AuditEvent, transaction: Prisma.TransactionClient = this.db) {
    return transaction.auditLog.create({ data: eventSchema.parse(event), select: { id: true } });
  }
}
