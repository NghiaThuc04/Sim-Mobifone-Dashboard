import { NON_NEGATIVE_DECIMAL_PATTERN } from './decimal';
export function isCommissionAbove100(rate: string): boolean {
  if (!new RegExp(NON_NEGATIVE_DECIMAL_PATTERN).test(rate)) return false;
  const [integer, fraction = ''] = rate.split('.');
  return BigInt(integer) > 100n || (BigInt(integer) === 100n && /[1-9]/.test(fraction));
}
export type CommissionPolicy = {
  id: string; employeeId: string; ratePercent: string; previousRatePercent: string | null;
  effectiveAt: string; createdBy: string; createdAt: string;
};
export type CommissionPolicyList = {
  current: CommissionPolicy | null; items: CommissionPolicy[];
  page: number; pageSize: number; total: number; totalPages: number;
};
