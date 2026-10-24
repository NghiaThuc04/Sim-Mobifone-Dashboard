export type SalaryPolicy = { id: string; employeeId: string; amount: string; previousAmount: string | null;
  effectiveFrom: string; createdBy: string; createdAt: string };
export type SalaryHistory = { current: SalaryPolicy | null; opening: SalaryPolicy | null; month: string;
  items: SalaryPolicy[]; total: number; page: number; pageSize: number; totalPages: number };
