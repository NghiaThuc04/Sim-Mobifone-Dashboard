'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CommissionPolicyList, NON_NEGATIVE_DECIMAL_PATTERN, isCommissionAbove100 } from '@sim-dashboard/shared';
import { apiRequest, ApiError } from '../lib/api-client';

const dateLabel = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));

export function EmployeeCommissionForm({ employeeId, history }: { employeeId: string; history: CommissionPolicyList }) {
  const router = useRouter();
  const [rate, setRate] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const localTime = String(values.get('effectiveAt') ?? '');
    if (scheduled && !Number.isFinite(Date.parse(localTime))) { setMessage('Thời điểm hiệu lực không hợp lệ.'); return; }
    setPending(true); setMessage('');
    try {
      await apiRequest(`/admin/employees/${employeeId}/commission-policy`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratePercent: rate, ...(scheduled ? { effectiveAt: new Date(localTime).toISOString() } : {}) }) });
      form.reset(); setRate(''); setMessage('Đã lưu chính sách mới và giữ nguyên lịch sử.'); router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { window.location.replace('/login'); return; }
      setMessage(error instanceof ApiError && error.status === 409 ? 'Đã có chính sách tại thời điểm này. Hãy chọn thời điểm khác.' : 'Không thể lưu tỷ lệ. Kiểm tra dữ liệu và quyền truy cập rồi thử lại.');
    } finally { setPending(false); }
  }
  const pageLink = (page: number) => `/admin/employees/${employeeId}?commissionPage=${page}`;
  return <section className="management-form commission-panel">
    <h2>Chính sách hoa hồng</h2><p>Tỷ lệ hiện hành: <strong>{history.current ? `${history.current.ratePercent}%` : 'Chưa thiết lập'}</strong></p>
    {history.current && <small>Hiệu lực từ {dateLabel(history.current.effectiveAt)} (giờ Việt Nam).</small>}
    <form onSubmit={submit} className="commission-fields">
      <label>Tỷ lệ phần trăm<input name="ratePercent" type="text" inputMode="decimal" required maxLength={66} pattern={NON_NEGATIVE_DECIMAL_PATTERN} placeholder="Ví dụ: 10.5" value={rate} onChange={(event) => setRate(event.target.value)} /></label>
      <small>Không âm; dùng dấu chấm thập phân. Tối đa 35 chữ số nguyên và 30 chữ số thập phân, không tự làm tròn.</small>
      {isCommissionAbove100(rate) && <p className="rate-warning" role="alert">Tỷ lệ vượt 100%: hoa hồng có thể lớn hơn lợi nhuận được duyệt. Chưa có trần tỷ lệ được chốt.</p>}
      <label className="schedule-option"><input type="checkbox" checked={scheduled} onChange={(event) => setScheduled(event.target.checked)} /> Chọn thời điểm hiệu lực</label>
      {scheduled ? <label>Thời điểm hiệu lực (theo múi giờ thiết bị)<input name="effectiveAt" type="datetime-local" step="0.001" required /></label> : <small>Áp dụng ngay theo đồng hồ database khi lưu.</small>}
      <p>Chỉ cấu hình tỷ lệ. Chưa tính hoặc duyệt hoa hồng. Đơn hàng về sau phải lưu snapshot tỷ lệ khi hoàn thành.</p>
      {message && <p role="status">{message}</p>}
      <div className="form-actions"><button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu chính sách mới'}</button></div>
    </form>
    <h3>Lịch sử chính sách</h3>
    {history.items.length ? <div className="table-scroll"><table><thead><tr><th>Tỷ lệ cũ → mới</th><th>Hiệu lực (VN)</th><th>Người thay đổi</th><th>Thời gian ghi nhận</th></tr></thead><tbody>{history.items.map((item) => <tr key={item.id}><td>{item.previousRatePercent === null ? 'Chưa thiết lập' : `${item.previousRatePercent}%`} → <strong>{item.ratePercent}%</strong></td><td>{dateLabel(item.effectiveAt)}</td><td><code>{item.createdBy}</code></td><td>{dateLabel(item.createdAt)}</td></tr>)}</tbody></table></div> : <p>Chưa có lịch sử tỷ lệ.</p>}
    <div className="pagination"><span>Trang {history.page} / {Math.max(1, history.totalPages)} · {history.total} chính sách</span><div>{history.page > 1 && <Link href={pageLink(history.page - 1)} prefetch={false}>← Trước</Link>}{history.page < history.totalPages && <Link href={pageLink(history.page + 1)} prefetch={false}>Sau →</Link>}</div></div>
  </section>;
}

