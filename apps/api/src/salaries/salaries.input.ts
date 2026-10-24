import { z } from 'zod';
import { NON_NEGATIVE_DECIMAL_PATTERN } from '@sim-dashboard/shared';
import { monthSchema, currentMonth } from '../common/calendar';

export const salaryInput = z.object({ amount: z.string().regex(new RegExp(NON_NEGATIVE_DECIMAL_PATTERN)),
  effectiveFrom: z.iso.datetime({ offset: true }).refine((value) => Number.isFinite(Date.parse(value)) && !/\.\d{4}/.test(value)).optional() }).strict();
export const salaryQuery = z.object({ month: monthSchema.default(currentMonth),
  page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10) }).strict();
