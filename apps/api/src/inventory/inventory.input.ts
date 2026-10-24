import { z } from 'zod';
import { SIM_STOCK_STATUSES, NON_NEGATIVE_DECIMAL_PATTERN, decimalUnits } from '@sim-dashboard/shared';
const optional = <T extends z.ZodType>(schema:T) => z.preprocess(value=>value===''?undefined:value,schema.optional());
export const priceInput=z.string().regex(new RegExp(NON_NEGATIVE_DECIMAL_PATTERN));
export const inventoryQuery=z.object({search:optional(z.string().trim().regex(/^\d{1,32}$/)),carrierId:optional(z.uuid()),categoryId:optional(z.uuid()),
  status:optional(z.enum(SIM_STOCK_STATUSES)),visibility:optional(z.enum(['visible','hidden'])),priceError:optional(z.enum(['true','false'])),
  minPrice:optional(priceInput),maxPrice:optional(priceInput),page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(value=>!value.minPrice||!value.maxPrice||decimalUnits(value.minPrice)!<=decimalUnits(value.maxPrice)!,{message:'Invalid price interval.'});
export type InventoryQuery=z.infer<typeof inventoryQuery>;
export const simInput=z.object({phoneNumber:z.string().trim().regex(/^\d{1,32}$/),carrierId:z.uuid(),categoryId:z.uuid(),costPrice:priceInput,sellingPrice:priceInput,
 stockStatus:z.enum(SIM_STOCK_STATUSES).default('AVAILABLE'),visibilityRequested:z.boolean().default(false)}).strict();
export type SimInput=z.infer<typeof simInput>;
export const simPatch=simInput.partial().extend({stockStatus:z.enum(SIM_STOCK_STATUSES).optional(),visibilityRequested:z.boolean().optional(),version:z.number().int().positive()}).strict().refine(value=>Object.keys(value).length>1,'No changes supplied.');
export const simSnapshotSchema=simInput.extend({isVisible:z.boolean(),hasPriceError:z.boolean(),version:z.number().int().positive()});
export const simHistoryQuery=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20)}).strict();
export const simRemovalInput = z.object({
 version: z.number().int().positive().max(2147483647),
 reason: z.string().trim().min(1).max(500).regex(/^[^\u0000]*$/).optional(),
}).strict();
