export const USER_ROLES = { ADMIN: 'ADMIN', STAFF: 'STAFF' } as const;
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type Account = { id: string; email: string; fullName: string; role: UserRole; permissions: readonly Permission[] };

export const PERMISSIONS = {
  ORDERS_VIEW: 'orders.view', ORDERS_CLAIM: 'orders.claim', ORDERS_UPDATE_OWN: 'orders.update.own',
  SIMS_VIEW: 'sims.view', SIMS_CREATE: 'sims.create', SIMS_DELETE_ELIGIBLE: 'sims.delete.eligible',
  ARTICLES_CREATE: 'articles.create', ARTICLES_PUBLISH: 'articles.publish',
  PROFITS_VIEW: 'profits.view', CHECK_SIM_VIEW: 'check-sim.view',
  PAYROLL_VIEW_SELF: 'payroll.view.self', LEAVES_VIEW_SELF: 'leaves.view.self',
  FINANCE_ADMIN: 'finance.admin', EMPLOYEES_ADMIN: 'employees.admin', SETTINGS_ADMIN: 'settings.admin',
} as const;
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export const STAFF_PERMISSIONS = [
  PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_CLAIM, PERMISSIONS.ORDERS_UPDATE_OWN,
  PERMISSIONS.SIMS_VIEW, PERMISSIONS.SIMS_CREATE, PERMISSIONS.SIMS_DELETE_ELIGIBLE,
  PERMISSIONS.ARTICLES_CREATE, PERMISSIONS.ARTICLES_PUBLISH,
  PERMISSIONS.PROFITS_VIEW, PERMISSIONS.CHECK_SIM_VIEW, PERMISSIONS.PAYROLL_VIEW_SELF, PERMISSIONS.LEAVES_VIEW_SELF,
] as const;
export type StaffPermission = typeof STAFF_PERMISSIONS[number];
export type EmployeePermission = { permission: StaffPermission; enabled: boolean };
export type EmployeePermissionMatrix = { employeeId: string; permissions: EmployeePermission[] };
export const PERMISSION_LABELS: Record<StaffPermission, string> = {
  'orders.view': 'Xem đơn hàng', 'orders.claim': 'Nhận đơn chưa có người giữ', 'orders.update.own': 'Xử lý đơn chính mình giữ',
  'sims.view': 'Xem kho SIM và giá bán', 'sims.create': 'Đăng SIM (quy trình chờ chốt)', 'sims.delete.eligible': 'Xóa SIM hoàn thành hoặc đã xác nhận lỗi',
  'articles.create': 'Viết bài', 'articles.publish': 'Đăng bài', 'profits.view': 'Xem lợi nhuận (không trả trường giá gốc)',
  'check-sim.view': 'Check SIM và xem cảnh báo', 'payroll.view.self': 'Xem bảng lương của mình', 'leaves.view.self': 'Xem ngày nghỉ của mình',
};
export function effectivePermissions(role: UserRole, overrides: readonly { permission: string; enabled: boolean }[]): Permission[] {
  if (role === USER_ROLES.ADMIN) return Object.values(PERMISSIONS);
  return STAFF_PERMISSIONS.filter((permission) => overrides.find((item) => item.permission === permission)?.enabled !== false);
}
export function hasPermission(account: Pick<Account, 'role' | 'permissions'>, permission: Permission): boolean {
  return account.role === USER_ROLES.ADMIN || (account.role === USER_ROLES.STAFF &&
    (STAFF_PERMISSIONS as readonly Permission[]).includes(permission) && account.permissions.includes(permission));
}
