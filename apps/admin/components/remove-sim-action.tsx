'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SimListItem } from '@sim-dashboard/shared';
import { ApiError, apiRequest } from '../lib/api-client';

export function RemoveSimAction({ sim }: { sim: Pick<SimListItem, 'id' | 'phoneNumber' | 'stockStatus' | 'version'> }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  async function remove() {
    setPending(true); setError('');
    try {
      await apiRequest(`/admin/sims/${sim.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: sim.version, ...(reason.trim() ? { reason: reason.trim() } : {}) }) });
      setRemoved(true); setConfirm(false); router.refresh();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) { window.location.replace('/login'); return; }
      setError(failure instanceof ApiError && [404, 409].includes(failure.status)
        ? 'SIM đã thay đổi hoặc đã rời kho. Hãy tra cứu lại trước khi tiếp tục.'
        : failure instanceof ApiError && failure.status === 403 ? 'Tài khoản không được phép xóa SIM này.'
        : 'Không thể xóa SIM. Vui lòng thử lại.');
    } finally { setPending(false); }
  }
  if (removed) return <p role="status">Đã bỏ SIM khỏi kho hoạt động, lịch sử được giữ nguyên.</p>;
  return <div className="employee-action">
    <button type="button" disabled={pending} onClick={() => { setConfirm(!confirm); setError(''); }}>Xóa khỏi kho hoạt động</button>
    {confirm && <div className="action-confirm"><h3>Xác nhận bỏ SIM {sim.phoneNumber} khỏi kho?</h3>
      <p>Trạng thái hiện tại: {sim.stockStatus}. SIM sẽ ngừng hiển thị và bán. Lịch sử được giữ nguyên; thao tác này không hủy hoặc sửa đơn hàng.</p>
      <p className="rate-warning">Chưa có nguồn đối soát đơn hàng. Nếu SIM đang được giữ hoặc đã bán, cần kiểm tra đơn liên quan riêng.</p>
      <label htmlFor={'remove-reason-' + sim.id}>Lý do (tùy chọn)</label>
      <textarea id={'remove-reason-' + sim.id} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} disabled={pending} />
      <div className="form-actions"><button type="button" disabled={pending} onClick={remove}>{pending ? 'Đang xóa…' : 'Xác nhận xóa khỏi kho'}</button>
        <button type="button" disabled={pending} onClick={() => setConfirm(false)}>Hủy</button></div>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
