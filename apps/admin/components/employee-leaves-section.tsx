import { LeaveMonth } from '@sim-dashboard/shared';
import { serverApiRequest, redirectForAuthError } from '../lib/server-api';
import { EmployeeLeavesForm } from './employee-leaves-form';
export async function EmployeeLeavesSection({ employeeId, month, page }: { employeeId: string; month?: string | string[]; page?: string | string[] }) {
  const query = new URLSearchParams();
  for (const [key, value] of [['month', month], ['page', page]] as const) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item)); else if (value) query.set(key, value);
  }
  const { data, error } = await serverApiRequest<LeaveMonth>(`/admin/employees/${employeeId}/leaves?${query}`);
  redirectForAuthError(error);
  return error ? <div role="alert" className="inline-error">{error}</div> : data && <EmployeeLeavesForm employeeId={employeeId} history={data} />;
}
