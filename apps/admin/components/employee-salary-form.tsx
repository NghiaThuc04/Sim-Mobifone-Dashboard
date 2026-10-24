'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SalaryHistory, NON_NEGATIVE_DECIMAL_PATTERN } from '@sim-dashboard/shared';
import { apiRequest, ApiError } from '../lib/api-client';

const dateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
export function EmployeeSalaryForm({ employeeId, history }: { employeeId: string; history: SalaryHistory }) {
  const router = useRouter();
  const [scheduled, setScheduled] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const localTime = String(data.get('effectiveFrom') ?? '');
    if (scheduled && !Number.isFinite(Date.parse(localTime))) { setMessage('Thời điểm không hợp lệ.'); return; }
    setPending(true); setMessage('');
    try {
      await apiRequest(`/admin/employees/${employeeId}/salary`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: data.get('amount'), ...(scheduled ? { effectiveFrom: new Date(localTime).toISOString() } : {}) }) });
      form.reset(); setMessage('Đã lưu mức lương mới, giữ nguyên lịch sử.'); router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { window.location.replace('/login'); return; }
      setMessage(error instanceof ApiError && error.status === 409 ? 'Đã có mức lương tại thời điểm này.' : 'Không thể lưu mức lương. Kiểm tra dữ liệu/quyền và thử lại.');
    } finally { setPending(false); }
  }
  const pageLink = (page: number) => `/admin/employees/${employeeId}?salaryMonth=${history.month}&salaryPage=${page}`;
  return <section className="management-form commission-panel">
    <h2>Lương cứng</h2><p>Hiện hành: <strong>{history.current ? `${history.current.amount} VND` : 'Chưa thiết lập'}</strong></p>
    <form className="commission-fields" onSubmit={submit}>
      <label>Mức lương mới (VND)<input name="amount" required inputMode="decimal" pattern={NON_NEGATIVE_DECIMAL_PATTERN} maxLength={66} placeholder="Nhập số tiền, không dấu phân cách hàng nghìn" /></label>
      <label className="schedule-option"><input type="checkbox" checked={scheduled} onChange={(event) => setScheduled(event.target.checked)} />Chọn thời điểm bắt đầu</label>
      {scheduled ? <label>Hiệu lực (theo múi giờ thiết bị)<input name="effectiveFrom" type="datetime-local" required step="0.001" /></label> : <small>Áp dụng ngay theo đồng hồ database khi lưu.</small>}
      <small>Không âm; dùng dấu chấm nếu có phần thập phân. Không tính bảng lương, thưởng/phụ cấp hoặc trừ ngày nghỉ.</small>
      {message && <p role="status">{message}</p>}<div className="form-actions"><button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu mức lương mới'}</button></div>
    </form>
    <form method="GET" action={`/admin/employees/${employeeId}`} className="commission-fields"><label>Tháng xem lịch sử lương<input name="salaryMonth" type="month" required defaultValue={history.month} /></label><div><button>Xem kỳ lương</button></div></form>
    <p>Mức có hiệu lực trước đầu kỳ: {history.opening ? `${history.opening.amount} VND` : 'Chưa thiết lập'}. Thay đổi giữa tháng chưa có quy tắc chia lương tự động.</p>
    <h3>Thay đổi trong tháng {history.month}</h3>
    {history.items.length ? <div className="table-scroll"><table><thead><tr><th>Cũ → mới (VND)</th><th>Hiệu lực (VN)</th><th>Người ghi</th></tr></thead><tbody>{history.items.map((item) => <tr key={item.id}><td>{item.previousAmount ?? 'Chưa thiết lập'} → {item.amount}</td><td>{dateLabel(item.effectiveFrom)}</td><td><code>{item.createdBy}</code></td></tr>)}</tbody></table></div> : <p>Không có thay đổi mức lương trong tháng này.</p>}
    <div className="pagination"><span>Trang {history.page}/{Math.max(1, history.totalPages)} · {history.total} thay đổi</span><div>{history.page > 1 && <Link href={pageLink(history.page - 1)} prefetch={false}>← Trước</Link>}{history.page < history.totalPages && <Link href={pageLink(history.page + 1)} prefetch={false}>Sau →</Link>}</div></div>
  </section>;
}
