import { z } from 'zod';
import { SIM_IMPORT_FIELDS,SIM_IMPORT_LIMITS } from '@sim-dashboard/shared';
import { simInput } from '../inventory/inventory.input';
export const importMapping=z.partialRecord(z.enum(SIM_IMPORT_FIELDS),z.number().int().min(0).max(SIM_IMPORT_LIMITS.columns-1)).refine(value=>['phoneNumber','carrierCode','categoryCode','costPrice','sellingPrice'].every(key=>key in value),'Required columns missing.').refine(value=>new Set(Object.values(value)).size===Object.keys(value).length,'Duplicate column mapping.');
export const previewInput=z.object({filename:z.string().min(1).max(200),contentBase64:z.string().min(4).max(Math.ceil(SIM_IMPORT_LIMITS.fileBytes/3)*4).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),sheetIndex:z.number().int().min(0).max(9).default(0),mapping:importMapping.optional()}).strict();
export const confirmInput=z.object({rows:z.array(z.number().int().min(2).max(SIM_IMPORT_LIMITS.rows+1)).min(1).max(SIM_IMPORT_LIMITS.rows),acceptPriceErrors:z.boolean().default(false)}).strict().refine(value=>new Set(value.rows).size===value.rows.length,'Duplicate selected rows.');
export const storedRows=z.array(z.object({row:z.number().int(),phoneNumber:z.string(),costPrice:z.string(),sellingPrice:z.string(),errors:z.array(z.string()),priceWarning:z.boolean(),data:simInput.nullable()}).strict());
export const resultSchema=z.object({success:z.number().int(),failed:z.number().int(),skipped:z.number().int(),items:z.array(z.object({row:z.number().int(),outcome:z.enum(['IMPORTED','FAILED','SKIPPED']),message:z.string(),simId:z.uuid().optional()}).strict())}).strict();
export type StoredRow=z.infer<typeof storedRows>[number];
