import { z } from 'zod';
import { ORDER_STATUSES } from '@sim-dashboard/shared';
import { currentMonth, monthSchema } from '../common/calendar';

export const internalOrderInput = z.object({
  idempotencyKey: z.uuid().transform(value => value.toLowerCase()), simId: z.uuid().transform(value => value.toLowerCase()),
  customer: z.object({
    fullName: z.string().trim().min(1).max(150).regex(/^[^\u0000]*$/),
    phone: z.string().trim().regex(/^\+?[0-9]{1,32}$/),
  }).strict(),
}).strict();
export type InternalOrderInput = z.infer<typeof internalOrderInput>;
export const orderCreateResult = z.object({ id: z.uuid(), orderCode: z.string().min(1).max(64), status: z.literal('PENDING') }).strict();
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(value => value === '' ? undefined : value, schema.optional());
const date = z.iso.date().refine(value => !value.startsWith('0000'));
export const ordersQuery = z.object({
  status: optional(z.enum(ORDER_STATUSES)), orderCode: optional(z.string().trim().min(1).max(64).regex(/^[^\u0000]*$/)),
  phoneNumber: optional(z.string().trim().regex(/^\d{1,32}$/)), assignedStaffId: optional(z.uuid()),
  month: monthSchema.default(currentMonth), fromDate: optional(date), toDate: optional(date),
  page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(value => (!value.fromDate && !value.toDate) || (!!value.fromDate && !!value.toDate && value.fromDate <= value.toDate), 'Supply both ordered date bounds.');
export type OrdersQuery = z.infer<typeof ordersQuery>;

export const orderId = z.uuid().transform(value => value.toLowerCase());
export const detailQuery = z.object({ itemPage: z.coerce.number().int().min(1).max(10000).default(1) }).strict();
export const claimInput = z.object({}).strict();
export const statusInput = z.object({ status: z.enum(ORDER_STATUSES) }).strict();
export const assignInput = z.object({ assignedStaffId: z.uuid().transform(value=>value.toLowerCase()).nullable(), reason: z.string().trim().max(500).regex(/^[^\u0000]*$/).optional() }).strict();
