'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiRequest } from '../lib/api-client';

export function CreateEmployeeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true); setMessage('');
    try {
      await apiRequest('/admin/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: values.get('fullName'), email: values.get('email'), password: values.get('password') }) });
      form.reset(); setOpen(false); setMessage('Đã tạo tài khoản STAFF.'); router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { window.location.replace('/login'); return; }
      setMessage(error instanceof ApiError && error.status === 409 ? 'Email đã được sử dụng.' : 'Không thể tạo tài khoản. Kiểm tra dữ liệu và quyền truy cập rồi thử lại.');
    } finally { setPending(false); }
  }
  return <section className="employee-editor">
    <button onClick={() => { setOpen(!open); setMessage(''); }} aria-expanded={open}>＋ Tạo nhân viên</button>
    {message && <p role="status">{message}</p>}
    {open && <form className="management-form" onSubmit={submit}>
      <h2>Tạo tài khoản STAFF</h2><p>Chỉ cấp vai trò nhân viên. Mật khẩu ban đầu không được lưu trong lịch sử thao tác.</p>
      <label>Họ tên<input name="fullName" required maxLength={150} autoComplete="off" /></label>
      <label>Email nhân viên<input name="email" type="email" required maxLength={254} autoComplete="off" /></label>
      <label>Mật khẩu ban đầu<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <small>Từ 12–128 ký tự, ít nhất 12 ký tự sau khi bỏ khoảng trắng ở hai đầu.</small>
      <div className="form-actions"><button disabled={pending} type="submit">{pending ? 'Đang tạo…' : 'Tạo tài khoản'}</button><button disabled={pending} type="button" onClick={() => setOpen(false)}>Hủy</button></div>
    </form>}
  </section>;
}
