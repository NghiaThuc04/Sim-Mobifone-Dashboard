import { z } from 'zod';
import { NON_NEGATIVE_DECIMAL_PATTERN, decimalUnits, sumDecimalStrings, leaveMonths } from '@sim-dashboard/shared';
import { currentMonth, monthSchema } from '../common/calendar';
const days = z.string().regex(new RegExp(NON_NEGATIVE_DECIMAL_PATTERN));
export const leaveInput = z.object({ fromDate: z.iso.date(), toDate: z.iso.date(), days,
  reason: z.string().trim().min(1).max(500), notes: z.string().trim().max(2000).default(''),
  allocations: z.array(z.object({ month: monthSchema, days }).strict()).min(1).max(120),
}).strict().superRefine((value, context) => {
  const months = leaveMonths(value.fromDate, value.toDate);
  const total = decimalUnits(value.days);
  const sum = sumDecimalStrings(value.allocations.map((item) => item.days));
  const valid = months.length > 0 && months.length === value.allocations.length &&
    new Set(value.allocations.map((item) => item.month)).size === months.length &&
    total !== null && total > 0n && sum !== null && decimalUnits(sum) === total && months.every((month) => {
      const allocation = value.allocations.find((item) => item.month === month.month);
      const count = allocation ? decimalUnits(allocation.days) : null;
      return count !== null && count <= decimalUnits(String(month.calendarDays))!;
    });
  if (!valid) context.addIssue({ code: 'custom', message: 'Explicit monthly allocations must match the valid leave period and confirmed total.' });
});
export const leaveQuery = z.object({ month: monthSchema.default(currentMonth),
  page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10) }).strict();
export type LeaveInput = z.infer<typeof leaveInput>;
