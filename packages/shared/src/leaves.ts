export type LeaveAllocation = { month: string; days: string };
export type LeaveRecord = { id: string; employeeId: string; fromDate: string; toDate: string; days: string;
  reason: string; notes: string; createdBy: string; createdAt: string; daysInMonth: string };
export type LeaveMonth = { employeeId: string; month: string; totalDays: string; items: LeaveRecord[];
  page: number; pageSize: number; total: number; totalPages: number };
export type MyLeaveMonth = Omit<LeaveMonth, 'employeeId' | 'items'> & {
  items: Pick<LeaveRecord, 'id' | 'fromDate' | 'toDate' | 'days' | 'daysInMonth' | 'reason' | 'notes'>[];
};

export function leaveMonths(from: string, to: string): { month: string; calendarDays: number }[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];
  const start = new Date(from + 'T00:00:00Z'); const end = new Date(to + 'T00:00:00Z');
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || start > end || start.toISOString().slice(0,10) !== from || end.toISOString().slice(0,10) !== to) return [];
  const count = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1;
  if (count > 120) return [];
  return Array.from({ length: count }, (_, index) => {
    const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    return { month: first.toISOString().slice(0,7), calendarDays: (Math.min(+last, +end) - Math.max(+first, +start)) / 86400000 + 1 };
  });
}
