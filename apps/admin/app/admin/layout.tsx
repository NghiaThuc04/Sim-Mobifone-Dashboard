import type { ReactNode } from 'react';
import { requireAccount } from '../../lib/server-session';
import { DashboardShell } from '../../components/dashboard-shell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return <DashboardShell user={await requireAccount()}>{children}</DashboardShell>;
}
