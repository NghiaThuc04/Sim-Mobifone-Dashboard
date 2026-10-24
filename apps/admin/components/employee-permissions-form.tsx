'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeePermissionMatrix, PERMISSION_LABELS } from '@sim-dashboard/shared';
import { apiRequest, ApiError } from '../lib/api-client';

export function EmployeePermissionsForm({ matrix }: { matrix: EmployeePermissionMatrix }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true); setMessage('');
    try {
      await apiRequest(`/admin/employees/${matrix.employeeId}/permissions`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: matrix.permissions.map(({ permission }) => ({ permission, enabled: values.has(permission) })) }) });
      setMessage('Đã lưu quyền. Request tiếp theo của nhân viên sẽ áp dụng quyền mới.'); router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { window.location.replace('/login'); return; }
      setMessage('Không thể cập nhật quyền. Vui lòng thử lại.');
    } finally { setPending(false); }
  }
  return <form className="management-form permission-form" onSubmit={submit}>
    <h2>Phân quyền nhân viên</h2><p>Chỉ cấu hình quyền cho các module. Những nghiệp vụ chưa triển khai vẫn là placeholder.</p>
    <fieldset disabled={pending}><legend>Quyền STAFF được phép cấu hình</legend>{matrix.permissions.map((item) => <label key={`${item.permission}:${item.enabled}`} className="permission-option"><input type="checkbox" name={item.permission} defaultChecked={item.enabled} /><span>{PERMISSION_LABELS[item.permission]}</span></label>)}</fieldset>
    <small>Không cấp quyền quản trị nhân viên, tài chính, cài đặt, sửa giá hoặc duyệt hoa hồng. Quyền xử lý đơn vẫn giới hạn đơn chính mình giữ.</small>
    {message && <p role="status">{message}</p>}
    <div className="form-actions"><button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu phân quyền'}</button></div>
  </form>;
}
