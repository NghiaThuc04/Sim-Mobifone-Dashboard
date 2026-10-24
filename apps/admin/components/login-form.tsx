'use client';

import { useState, type FormEvent } from 'react';
import { apiRequest, ApiError } from '../lib/api-client';

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      await apiRequest('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
      window.location.replace('/admin/dashboard');
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 401 ? 'Email hoặc mật khẩu không đúng, hoặc tài khoản đang bị khóa.' : failure instanceof ApiError && failure.status === 429 ? 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.' : 'Chưa thể đăng nhập. Vui lòng thử lại.');
      setBusy(false);
    }
  }
  return <form onSubmit={submit} className="login-form">
    <label htmlFor="email">Email tài khoản</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="Nhập email của bạn" />
    <label htmlFor="password">Mật khẩu</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} placeholder="Nhập mật khẩu" />
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}<span aria-hidden="true">→</span></button>
  </form>;
}
