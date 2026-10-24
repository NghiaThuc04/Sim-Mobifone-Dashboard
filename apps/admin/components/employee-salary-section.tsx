import { SalaryHistory } from '@sim-dashboard/shared';
import { serverApiRequest, redirectForAuthError } from '../lib/server-api';
import { EmployeeSalaryForm } from './employee-salary-form';
export async function EmployeeSalarySection({ employeeId, month, page }: { employeeId: string; month?: string | string[]; page?: string | string[] }) {
  const query = new URLSearchParams();
  for (const [key, value] of [['month', month], ['page', page]] as const) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item)); else if (value) query.set(key, value);
  }
  const { data, error } = await serverApiRequest<SalaryHistory>(`/admin/employees/${employeeId}/salary?${query}`);
  redirectForAuthError(error);
  return error ? <div role="alert" className="inline-error">{error}</div> : data && <EmployeeSalaryForm employeeId={employeeId} history={data} />;
}
