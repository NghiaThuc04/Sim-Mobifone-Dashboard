import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Account, hasPermission, Permission } from '@sim-dashboard/shared';
import { apiOrigin } from './api-origin';

export const currentAccount = cache(async (): Promise<Account | null> => {
  const response = await fetch(apiOrigin() + '/api/v1/auth/me', {
    headers: { Cookie: (await cookies()).toString() }, cache: 'no-store', signal: AbortSignal.timeout(5000),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Không thể kiểm tra phiên. Vui lòng thử lại.');
  const body = await response.json() as { user: Account };
  return body.user;
});

export async function requireAccount(permission?: Permission): Promise<Account> {
  const user = await currentAccount();
  if (!user) redirect('/login');
  if (permission && !hasPermission(user, permission)) redirect('/forbidden');
  return user;
}
