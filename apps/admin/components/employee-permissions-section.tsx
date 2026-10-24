import { EmployeePermissionMatrix } from '@sim-dashboard/shared';
import { serverApiRequest, redirectForAuthError } from '../lib/server-api';
import { EmployeePermissionsForm } from './employee-permissions-form';

export async function EmployeePermissionsSection({ employeeId }: { employeeId: string }) {
  const { data, error } = await serverApiRequest<EmployeePermissionMatrix>(`/admin/employees/${employeeId}/permissions`);
  redirectForAuthError(error);
  return error ? <div className="inline-error" role="alert">{error}</div> : data && <EmployeePermissionsForm matrix={data} />;
}
