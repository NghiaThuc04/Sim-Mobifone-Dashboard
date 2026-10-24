'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Employee } from '@sim-dashboard/shared';
import { ApiError, apiRequest } from '../lib/api-client';

export function EmployeeStatusAction({ employee }: { employee: Employee }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const locking = employee.status === 'active';
  async function update() {
    setPending(true); setError('');
    try {
      await apiRequest(`/admin/employees/${employee.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: locking ? 'locked' : 'active' }) });
      setConfirm(false); router.refresh();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) { window.location.replace('/login'); return; }
      setError('Không thể cập nhật trạng thái. Vui lòng thử lại.');
    } finally { setPending(false); }
  }
  return <div className="employee-action">
    <button onClick={() => { setConfirm(!confirm); setError(''); }}>{locking ? 'Khóa' : 'Mở khóa'}</button>
    {confirm && <div className="action-confirm"><p>{locking ? 'Khóa tài khoản và thu hồi mọi phiên đăng nhập?' : 'Cho phép nhân viên đăng nhập trở lại?'}</p><div className="form-actions"><button disabled={pending} onClick={update}>{pending ? 'Đang lưu…' : 'Xác nhận'}</button><button disabled={pending} onClick={() => setConfirm(false)}>Hủy</button></div></div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
