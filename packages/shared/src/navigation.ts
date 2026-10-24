import { PERMISSIONS, type Permission } from './permissions';

export type DashboardModule = { path: string; label: string; description: string; permission?: Permission };
export const DASHBOARD_MODULES: readonly DashboardModule[] = [
  { path: '/admin/dashboard', label: 'Tổng quan', description: 'Theo dõi hoạt động và các chỉ số vận hành.' },
  { path: '/admin/orders', label: 'Đơn hàng', description: 'Tiếp nhận và xử lý đơn theo quyền được cấp.', permission: PERMISSIONS.ORDERS_VIEW },
  { path: '/admin/orders/completed', label: 'Đơn hoàn thành', description: 'Kiểm tra các đơn đã hoàn thành.', permission: PERMISSIONS.ORDERS_VIEW },
  { path: '/admin/inventory', label: 'Kho SIM', description: 'Tra cứu danh sách và tình trạng kho số.', permission: PERMISSIONS.SIMS_VIEW },
  { path: '/admin/check-sim', label: 'Check SIM', description: 'Kiểm tra thông tin và tình trạng SIM.', permission: PERMISSIONS.CHECK_SIM_VIEW },
  { path: '/admin/alerts/sim-pricing', label: 'Cảnh báo SIM', description: 'Theo dõi cảnh báo giá trong kho.', permission: PERMISSIONS.CHECK_SIM_VIEW },
  { path: '/admin/articles', label: 'Bài viết', description: 'Quản lý nội dung và tin tức.', permission: PERMISSIONS.ARTICLES_CREATE },
  { path: '/admin/finance', label: 'Tài chính', description: 'Xem báo cáo và đối soát tài chính.', permission: PERMISSIONS.FINANCE_ADMIN },
  { path: '/admin/employees', label: 'Nhân viên', description: 'Tra cứu tài khoản nội bộ.', permission: PERMISSIONS.EMPLOYEES_ADMIN },
  { path: '/admin/settings', label: 'Cài đặt', description: 'Quản lý cấu hình hệ thống.', permission: PERMISSIONS.SETTINGS_ADMIN },
  { path: '/admin/my-leaves', label: 'Ngày nghỉ của tôi', description: 'Xem ngày nghỉ đã được ghi nhận cho chính mình.', permission: PERMISSIONS.LEAVES_VIEW_SELF },
  { path: '/admin/catalogs', label: 'Danh mục SIM', description: 'Quản lý danh mục nhà mạng và loại SIM.', permission: PERMISSIONS.SETTINGS_ADMIN },
];
