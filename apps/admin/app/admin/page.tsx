import { redirect } from 'next/navigation';
import { requireAccount } from '../../lib/server-session';
export default async function AdminPage() { await requireAccount(); redirect('/admin/dashboard'); }
