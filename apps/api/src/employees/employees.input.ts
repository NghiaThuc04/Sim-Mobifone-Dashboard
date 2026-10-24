import { userIdentitySchema, newPasswordSchema } from '../users/user-input';
import { z } from 'zod';
import { USER_STATUSES, STAFF_PERMISSIONS } from '@sim-dashboard/shared';

export const createEmployeeSchema = userIdentitySchema.extend({ password: newPasswordSchema });
export const employeeIdSchema = z.uuid();
export const employeeStatusSchema = z.object({ status: z.enum(Object.values(USER_STATUSES)) }).strict();
export const resetEmployeePasswordSchema = z.object({ password: newPasswordSchema }).strict();
export const employeePermissionsSchema = z.object({ permissions: z.array(z.object({
  permission: z.enum(STAFF_PERMISSIONS), enabled: z.boolean(),
}).strict()).length(STAFF_PERMISSIONS.length).refine((items) => new Set(items.map((item) => item.permission)).size === STAFF_PERMISSIONS.length) }).strict();
