import { z } from 'zod';
import { USER_ROLES, USER_STATUSES } from '@sim-dashboard/shared';
export const employeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  role: z.enum(Object.values(USER_ROLES)).optional(),
  status: z.enum(Object.values(USER_STATUSES)).optional(),
}).strict();
export type EmployeesQuery = z.infer<typeof employeesQuerySchema>;
