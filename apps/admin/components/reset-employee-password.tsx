'use client';

import { useState, type FormEvent } from 'react';
import { ApiError, apiRequest } from '../lib/api-client';

export function ResetEmployeePassword({ employeeId }: { employeeId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    if (values.get('password') !== values.get('confirmation')) { setMessage('Mật khẩu xác nhận chưa khớp.'); return; }
    setPending(true); setMessage('');
    try {
      await apiRequest(`/admin/employees/${employeeId}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: values.get('password') }) });
      form.reset(); setMessage('Đã đặt mật khẩu mới và thu hồi các phiên cũ.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { window.location.replace('/login'); return; }
      setMessage('Không thể đặt lại mật khẩu. Kiểm tra quyền truy cập và thử lại.');
    } finally { setPending(false); }
  }
  return <form className="management-form" onSubmit={submit}>
    <h2>Đặt lại mật khẩu</h2><p>Thao tác này thu hồi mọi phiên của nhân viên. Không thể xem hoặc khôi phục mật khẩu cũ.</p>
    <label>Mật khẩu mới<input type="password" name="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
    <label>Xác nhận mật khẩu mới<input type="password" name="confirmation" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
    <small>Từ 12–128 ký tự, ít nhất 12 ký tự sau khi bỏ khoảng trắng ở hai đầu. Chưa gửi email/SMS tự động.</small>
    {message && <p role="status">{message}</p>}
    <div className="form-actions"><button type="submit" disabled={pending}>{pending ? 'Đang cập nhật…' : 'Đặt lại mật khẩu và thu hồi phiên'}</button></div>
  </form>;
}
