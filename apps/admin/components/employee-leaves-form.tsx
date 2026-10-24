'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LeaveMonth, leaveMonths, sumDecimalStrings, NON_NEGATIVE_DECIMAL_PATTERN } from '@sim-dashboard/shared';
import { apiRequest, ApiError } from '../lib/api-client';
import { LeaveRecordsTable } from './leave-records-table';

export function EmployeeLeavesForm({ employeeId, history }: { employeeId: string; history: LeaveMonth }) {
  const router = useRouter();
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [counts, setCounts] = useState<Record<string,string>>({});
  const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
  const months = leaveMonths(from, to);
  const allocations = months.map((item) => ({ month: item.month, days: counts[item.month] ?? '' }));
  const total = allocations.length ? sumDecimalStrings(allocations.map((item) => item.days)) : null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    setPending(true); setMessage('');
    try {
      await apiRequest(`/admin/employees/${employeeId}/leaves`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        fromDate: from, toDate: to, days: total, allocations, reason: data.get('reason'), notes: data.get('notes'),
      }) });
      form.reset(); setFrom(''); setTo(''); setCounts({}); setMessage('Đã ghi nhận ngày nghỉ và phân bổ theo tháng.'); router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { window.location.replace('/login'); return; }
      setMessage(error instanceof ApiError && error.status === 409 ? 'Khoảng nghỉ trùng với bản ghi đã có. Không cộng thêm lần nữa.' : 'Không thể ghi nhận. Kiểm tra khoảng ngày và số ngày xác nhận từng tháng.');
    } finally { setPending(false); }
  }
  const href = (page: number) => `/admin/employees/${employeeId}?leaveMonth=${history.month}&leavePage=${page}`;
  return <section className="management-form commission-panel">
    <h2>Ngày nghỉ nhân viên</h2><p>Chỉ ghi nhận số ngày Admin xác nhận. Không tự trừ lương hoặc loại cuối tuần/ngày lễ.</p>
    <form onSubmit={submit} className="commission-fields">
      <label>Ngày bắt đầu nghỉ<input type="date" required value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>Ngày kết thúc nghỉ<input type="date" required value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
      {months.map((item) => <label key={item.month}>Ngày nghỉ xác nhận tháng {item.month}<input required inputMode="decimal" pattern={NON_NEGATIVE_DECIMAL_PATTERN} maxLength={66} value={counts[item.month] ?? ''} onChange={(event) => setCounts({ ...counts, [item.month]: event.target.value })} /><small>Khoảng ngày thuộc tháng này: {item.calendarDays} ngày lịch. Admin nhập số ngày đã xác nhận.</small></label>)}
      {!months.length && <small>Chọn khoảng ngày hợp lệ (tối đa 120 tháng trong một bản ghi).</small>}
      <p>Tổng ngày đã xác nhận: <output aria-live="polite">{total ?? 'Chưa đủ dữ liệu'}</output></p>
      <label>Lý do nghỉ<textarea name="reason" required maxLength={500} rows={2} /></label>
      <label>Ghi chú cho nhân viên<textarea name="notes" maxLength={2000} rows={2} /></label>
      {message && <p role="status">{message}</p>}<div className="form-actions"><button type="submit" disabled={pending || !total || total === '0'}>{pending ? 'Đang ghi…' : 'Ghi nhận ngày nghỉ'}</button></div>
    </form>
    <form method="GET" action={`/admin/employees/${employeeId}`} className="commission-fields"><label>Tháng xem ngày nghỉ<input type="month" name="leaveMonth" required defaultValue={history.month} /></label><div><button>Xem ngày nghỉ</button></div></form>
    <p>Tổng tháng {history.month}: <strong>{history.totalDays} ngày</strong></p>
    <LeaveRecordsTable items={history.items} />
    <div className="pagination"><span>Trang {history.page}/{Math.max(1, history.totalPages)} · {history.total} đợt nghỉ</span><div>{history.page > 1 && <Link href={href(history.page - 1)} prefetch={false}>← Trước</Link>}{history.page < history.totalPages && <Link href={href(history.page + 1)} prefetch={false}>Sau →</Link>}</div></div>
  </section>;
}
