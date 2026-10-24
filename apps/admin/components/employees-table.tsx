import Link from 'next/link';
import type { EmployeeList } from '@sim-dashboard/shared';
import { EmployeeStatusAction } from './employee-status-action';

export function EmployeesTable({ result, query }: { result: EmployeeList; query: URLSearchParams }) {
  const pageLink = (page: number) => { const value = new URLSearchParams(query); value.set('page', String(page)); return '/admin/employees?' + value.toString(); };
  return <section className="table-panel" aria-label="Danh sách tài khoản">
    <div className="table-caption"><strong>Tài khoản nội bộ</strong><span>{result.total} tài khoản</span></div>
    {result.items.length === 0 ? <div className="table-empty"><h2>Không tìm thấy tài khoản</h2><p>Thử thay đổi từ khóa hoặc bộ lọc để tìm lại.</p></div> : <div className="table-scroll"><table><thead><tr><th scope="col">Họ tên</th><th scope="col">Email</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Hoa hồng hiện hành</th><th scope="col">Ngày tạo</th><th scope="col">Thao tác</th></tr></thead><tbody>{result.items.map((employee) => <tr key={employee.id}><td><strong>{employee.fullName}</strong></td><td>{employee.email}</td><td><span className={`role-badge ${employee.role === 'ADMIN' ? 'admin-role' : ''}`}>{employee.role === 'ADMIN' ? 'ADMIN' : 'STAFF'}</span></td><td><span className={`account-status ${employee.status}`}><i />{employee.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</span></td><td>{employee.role === 'ADMIN' ? '—' : employee.commissionRatePercent === null ? 'Chưa thiết lập' : `${employee.commissionRatePercent}%`}</td><td>{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(employee.createdAt))}</td><td>{employee.role === 'STAFF' ? <div className="employee-action"><Link href={`/admin/employees/${employee.id}`} prefetch={false}>Quản lý</Link><EmployeeStatusAction employee={employee} /></div> : '—'}</td></tr>)}</tbody></table></div>}
    <div className="pagination"><span>Trang {result.page} / {Math.max(1, result.totalPages)} · {result.pageSize} tài khoản / trang</span><div>{result.page > 1 ? <Link href={pageLink(result.page - 1)} prefetch={false}>← Trước</Link> : <span aria-disabled="true">← Trước</span>}{result.page < result.totalPages ? <Link href={pageLink(result.page + 1)} prefetch={false}>Sau →</Link> : <span aria-disabled="true">Sau →</span>}</div></div>
  </section>;
}



