import { z } from 'zod';
import { CATALOG_KINDS } from '@sim-dashboard/shared';
export const catalogKind = z.enum(CATALOG_KINDS);
export const catalogInput = z.object({ code:z.string().trim().toLowerCase().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), name:z.string().trim().min(1).max(150) }).strict();
export const catalogQuery = z.object({ search:z.string().trim().max(100).optional(), page:z.coerce.number().int().min(1).max(10000).default(1), pageSize:z.coerce.number().int().min(1).max(100).default(20) }).strict();
export type CatalogInput = z.infer<typeof catalogInput>;
export type CatalogQuery = z.infer<typeof catalogQuery>;
