import { z } from 'zod';
import { NON_NEGATIVE_DECIMAL_PATTERN } from '@sim-dashboard/shared';

// Match NUMERIC(65,30) exactly; reject excess precision instead of rounding an administrator's input.
export const commissionRateSchema = z.string().regex(new RegExp(NON_NEGATIVE_DECIMAL_PATTERN));
export const commissionPolicySchema = z.object({
  ratePercent: commissionRateSchema,
  effectiveAt: z.iso.datetime({ offset: true }).refine((value) => Number.isFinite(Date.parse(value)) && !/\.\d{4}/.test(value)).optional(),
}).strict();
export const commissionHistoryQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).strict();

