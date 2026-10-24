export type PriceAlertItem = {
  id: string; simId: string; phoneNumber: string; sellingPrice: string; costPrice?: string;
  difference?: string; detectedAt: string; resolvedAt: string | null; deletedAt: string | null;
};
export type PriceAlertList = {
  items: PriceAlertItem[]; total: number; openCount: number; page: number; pageSize: number;
  totalPages: number; canViewCost: boolean; canViewDifference: boolean;
};
export type SimRemovalEligibility = { allowed: boolean; reason: 'ADMIN' | 'VERIFIED_SOURCE_MISSING' | 'PERMISSION_DENIED' };
export type SimCheckResult = {
  match: 'ACTIVE_ONLY';
  item: (import('./inventory').SimListItem & {
    orderSource: 'NOT_IMPLEMENTED';
    errorConfirmation: { verification: 'UNVERIFIED'; recordedAt: string | null };
    removal: SimRemovalEligibility;
  }) | null;
};
