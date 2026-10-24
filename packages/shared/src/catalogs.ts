export const CATALOG_KINDS = ['carriers','sim-categories'] as const;
export type CatalogKind = typeof CATALOG_KINDS[number];
export type CatalogItem = { id: string; code: string; name: string; createdAt: string; updatedAt: string };
export type CatalogList = { items: CatalogItem[]; total: number; page: number; pageSize: number; totalPages: number };
