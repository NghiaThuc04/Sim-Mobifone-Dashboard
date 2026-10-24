import Link from 'next/link';
import { Employee, PERMISSIONS } from '@sim-dashboard/shared';
import { requireAccount } from '../../../../lib/server-session';
import { serverApiRequest, redirectForAuthError } from '../../../../lib/server-api';
import { ResetEmployeePassword } from '../../../../components/reset-employee-password';
import { EmployeeStatusAction } from '../../../../components/employee-status-action';
import { EmployeePermissionsSection } from '../../../../components/employee-permissions-section';
import { EmployeeCommissionSection } from '../../../../components/employee-commission-section';
import { EmployeeSalarySection } from '../../../../components/employee-salary-section';
import { EmployeeLeavesSection } from '../../../../components/employee-leaves-section';

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  await requireAccount(PERMISSIONS.EMPLOYEES_ADMIN);
  const { id } = await params;
  const { commissionPage, salaryMonth, salaryPage, leaveMonth, leavePage } = await searchParams;
  const { data: employee, error } = await serverApiRequest<Employee>('/admin/employees/' + encodeURIComponent(id));
  redirectForAuthError(error);
  return <>
    <Link href="/admin/employees" prefetch={false}>← Danh sách nhân viên</Link>
    <div className="page-heading"><div><span className="eyebrow">QUẢN LÝ STAFF</span><h1>{employee?.fullName ?? 'Tài khoản nhân viên'}</h1><p>{employee?.email}</p></div><span className="status-badge">Chỉ ADMIN</span></div>
    {error ? <div className="inline-error" role="alert">{error}</div> : employee && <div className="employee-management-grid">
      <section className="management-form"><h2>Trạng thái tài khoản</h2><p>{employee.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</p><EmployeeStatusAction employee={employee} /></section>
      <ResetEmployeePassword employeeId={employee.id} />
      <EmployeePermissionsSection employeeId={employee.id} />
      <EmployeeCommissionSection employeeId={employee.id} page={commissionPage} />
      <EmployeeSalarySection employeeId={employee.id} month={salaryMonth} page={salaryPage} />
      <EmployeeLeavesSection employeeId={employee.id} month={leaveMonth} page={leavePage} />
    </div>}
  </>;
}
