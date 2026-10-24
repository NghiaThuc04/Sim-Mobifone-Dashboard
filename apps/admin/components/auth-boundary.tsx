'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Account } from '@sim-dashboard/shared';
import { apiRequest, ApiError } from '../lib/api-client';

export function AuthBoundary({ user, children }: { user: Account; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    const conceal = () => { document.documentElement.dataset.authVerified = 'false'; };
    const verify = async () => {
      conceal();
      try {
        const result = await apiRequest<{ user: Account }>('/auth/me');
        if (disposed) return;
        if (result.user.id !== user.id || result.user.role !== user.role || result.user.email !== user.email || result.user.fullName !== user.fullName || JSON.stringify(result.user.permissions) !== JSON.stringify(user.permissions)) { window.location.reload(); return; }
        document.documentElement.dataset.authVerified = 'true';
        setReady(true); setError(false);
      } catch (failure) {
        if (disposed) return;
        if (failure instanceof ApiError && failure.status === 401) window.location.replace('/login');
        else { setReady(false); setError(true); }
      }
    };
    void verify();
    const recheck = () => { void verify(); };
    window.addEventListener('pageshow', recheck);
    window.addEventListener('popstate', recheck);
    window.addEventListener('focus', recheck);
    window.addEventListener('pagehide', conceal);
    return () => {
      disposed = true;
      window.removeEventListener('pageshow', recheck); window.removeEventListener('popstate', recheck);
      window.removeEventListener('focus', recheck); window.removeEventListener('pagehide', conceal);
    };
  }, [user]);
  return <>
    {!ready && <div className="session-check" role="status">{error ? <><h1>Chưa thể xác minh phiên</h1><p>Vui lòng kiểm tra kết nối và thử lại.</p><button onClick={() => window.location.reload()}>Thử lại</button></> : 'Đang kiểm tra phiên đăng nhập…'}</div>}
    <div className="authenticated-content" style={{ display: ready ? undefined : 'none' }}>{children}</div>
  </>;
}
