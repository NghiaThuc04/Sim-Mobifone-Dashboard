import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiOrigin } from './api-origin';

export async function serverApiRequest<T>(path: string): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(apiOrigin() + '/api/v1' + path, {
      headers: { Cookie: (await cookies()).toString() }, cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401) return { error: 'unauthorized' };
    if (response.status === 403) return { error: 'forbidden' };
    if (response.status === 404) return { error: 'not_found' };
    if (response.status === 400) return { error: 'Bộ lọc không hợp lệ. Vui lòng kiểm tra và thử lại.' };
    if (!response.ok) return { error: 'Chưa thể tải danh sách. Vui lòng thử lại.' };
    return { data: await response.json() as T };
  } catch { return { error: 'Không thể kết nối dịch vụ. Vui lòng thử lại.' }; }
}

export function redirectForAuthError(error?: string) {
  if (error === 'unauthorized') redirect('/login');
  if (error === 'forbidden') redirect('/forbidden');
}
