import { notFound } from 'next/navigation';
import { DASHBOARD_MODULES } from '@sim-dashboard/shared';
import { requireAccount } from '../../../lib/server-session';
import { ModulePlaceholder } from '../../../components/module-placeholder';

export default async function ModulePage({ params }: { params: Promise<{ segments: string[] }> }) {
  const path = '/admin/' + (await params).segments.join('/');
  const feature = DASHBOARD_MODULES.find((item) => item.path === path);
  if (!feature) notFound();
  await requireAccount(feature.permission);
  return <ModulePlaceholder module={feature} />;
}
