import type { UserRole } from './permissions';
export const USER_STATUSES = { ACTIVE: 'active', LOCKED: 'locked' } as const;
export type UserStatus = typeof USER_STATUSES[keyof typeof USER_STATUSES];
export type Employee = { id: string; fullName: string; email: string; role: UserRole; status: UserStatus; createdAt: string; commissionRatePercent: string | null };
export type EmployeeList = { items: Employee[]; page: number; pageSize: number; total: number; totalPages: number };
