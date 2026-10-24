import Link from 'next/link';
import { EmployeeList, PERMISSIONS } from '@sim-dashboard/shared';
import { requireAccount } from '../../../lib/server-session';
import { serverApiRequest, redirectForAuthError } from '../../../lib/server-api';
import { EmployeesTable } from '../../../components/employees-table';
import { CreateEmployeeForm } from '../../../components/create-employee-form';

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAccount(PERMISSIONS.EMPLOYEES_ADMIN);
  const input = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value) query.set(key, value);
    else if (Array.isArray(value)) for (const item of value) query.append(key, item);
  }
  const { data, error } = await serverApiRequest<EmployeeList>('/admin/employees?' + query);
  redirectForAuthError(error);
  return <>
    <div className="page-heading"><div><span className="eyebrow">QUẢN TRỊ HỆ THỐNG</span><h1>Nhân viên</h1><p>Quản lý tài khoản nhân viên và trạng thái truy cập.</p></div><span className="status-badge">Chỉ ADMIN</span></div>
    <CreateEmployeeForm />
    <form action="/admin/employees" method="GET" className="employee-filters">
      <div className="search-filter"><label htmlFor="employee-search">Tìm kiếm</label><input id="employee-search" name="search" type="search" maxLength={100} defaultValue={query.get('search') ?? ''} placeholder="Họ tên hoặc email" /></div>
      <div><label htmlFor="employee-role">Vai trò</label><select id="employee-role" name="role" defaultValue={query.get('role') ?? ''}><option value="">Tất cả vai trò</option><option value="ADMIN">ADMIN</option><option value="STAFF">STAFF</option></select></div>
      <div><label htmlFor="employee-status">Trạng thái</label><select id="employee-status" name="status" defaultValue={query.get('status') ?? ''}><option value="">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="locked">Đã khóa</option></select></div>
      <div><label htmlFor="employee-page-size">Mỗi trang</label><select id="employee-page-size" name="pageSize" defaultValue={query.get('pageSize') ?? '20'}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></div>
      <button type="submit">Tìm kiếm</button><Link className="reset-filters" href="/admin/employees" prefetch={false}>Đặt lại</Link>
    </form>
    {error ? <div className="inline-error" role="alert">{error} <Link href="/admin/employees" prefetch={false}>Thử lại</Link></div> : data && <EmployeesTable result={data} query={query} />}
  </>;
}
