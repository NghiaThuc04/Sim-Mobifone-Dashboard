import { DASHBOARD_MODULES } from '@sim-dashboard/shared';
import { requireAccount } from '../../../lib/server-session';
import { ModulePlaceholder } from '../../../components/module-placeholder';

export default async function DashboardPage() {
  await requireAccount();
  return <ModulePlaceholder module={DASHBOARD_MODULES[0]} />;
}
