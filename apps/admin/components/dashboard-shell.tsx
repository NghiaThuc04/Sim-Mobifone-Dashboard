'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Account, DASHBOARD_MODULES, hasPermission } from '@sim-dashboard/shared';
import { apiRequest } from '../lib/api-client';
import { AuthBoundary } from './auth-boundary';

export function DashboardShell({ user, children }: { user: Account; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const modules = DASHBOARD_MODULES.filter((item) => !item.permission || hasPermission(user, item.permission));
  const current = [...modules].sort((left, right) => right.path.length - left.path.length)
    .find((item) => item.path === pathname || pathname.startsWith(item.path + '/'));
  async function logout() {
    setBusy(true); setError('');
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
      document.documentElement.dataset.authVerified = 'false';
      window.location.replace('/login');
    } catch { setError('Chưa thể đăng xuất. Vui lòng thử lại.'); setBusy(false); }
  }
  return <AuthBoundary user={user}>
    <div className="dashboard-app">
      {open && <button className="nav-backdrop" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Điều hướng Dashboard">
        <Link className="brand" href="/admin/dashboard" prefetch={false}><span className="brand-symbol">S</span><span>SIM Management<small>KHÔNG GIAN QUẢN TRỊ</small></span></Link>
        <div className="sidebar-heading">KHÔNG GIAN LÀM VIỆC</div>
        <nav>{modules.map((item, index) => <Link key={item.path} href={item.path} prefetch={false} className={`nav-item ${pathname === item.path ? 'active' : ''}`} aria-current={pathname === item.path ? 'page' : undefined} onClick={() => setOpen(false)}><span className="nav-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{item.label}{pathname === item.path && <span className="active-dot" />}</Link>)}</nav>
        <div className="sidebar-footer"><span className="online-dot" /> Phiên làm việc được bảo vệ<small>SIM Management · Nội bộ</small></div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="menu-toggle" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
          <div className="breadcrumb">Không gian quản trị <span>/</span> <strong>{current?.label ?? 'Dashboard'}</strong></div>
          <div className="account-area"><span className="avatar" aria-hidden="true">{user.fullName.slice(0, 1).toUpperCase()}</span><div className="account-copy"><strong>{user.fullName}</strong><small>{user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}</small></div><button className="logout-button" onClick={logout} disabled={busy}>{busy ? 'Đang thoát…' : 'Đăng xuất'}</button></div>
        </header>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <main id="main-content" className="page-content">{children}</main>
        <footer className="app-footer"><span>SIM Management Dashboard</span><span>Quản lý tập trung · Truy cập theo phân quyền</span></footer>
      </div>
    </div>
  </AuthBoundary>;
}
