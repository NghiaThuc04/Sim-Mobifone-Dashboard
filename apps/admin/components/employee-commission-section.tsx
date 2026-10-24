import { CommissionPolicyList } from '@sim-dashboard/shared';
import { serverApiRequest, redirectForAuthError } from '../lib/server-api';
import { EmployeeCommissionForm } from './employee-commission-form';

export async function EmployeeCommissionSection({ employeeId, page }: { employeeId: string; page?: string | string[] }) {
  const query = new URLSearchParams();
  if (Array.isArray(page)) page.forEach((value) => query.append('page', value));
  else if (page) query.set('page', page);
  const { data, error } = await serverApiRequest<CommissionPolicyList>(`/admin/employees/${employeeId}/commission-policy?${query}`);
  redirectForAuthError(error);
  return error ? <div className="inline-error" role="alert">{error}</div> : data && <EmployeeCommissionForm employeeId={employeeId} history={data} />;
}
