import Link from 'next/link';
import { PERMISSIONS, MyLeaveMonth } from '@sim-dashboard/shared';
import { requireAccount } from '../../../lib/server-session';
import { serverApiRequest, redirectForAuthError } from '../../../lib/server-api';
import { LeaveRecordsTable } from '../../../components/leave-records-table';

export default async function MyLeavesPage({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  await requireAccount(PERMISSIONS.LEAVES_VIEW_SELF);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item)); else if (value) query.set(key, value);
  }
  const { data, error } = await serverApiRequest<MyLeaveMonth>('/me/leaves?' + query);
  redirectForAuthError(error);
  const href = (page: number) => `/admin/my-leaves?month=${data?.month}&page=${page}`;
  return <>
    <div className="page-heading"><div><span className="eyebrow">THÔNG TIN CÁ NHÂN</span><h1>Ngày nghỉ của tôi</h1><p>Số ngày Admin đã xác nhận, chỉ đọc. Không phải chức năng xin nghỉ.</p></div><span className="status-badge">Theo phiên đăng nhập</span></div>
    {error ? <div className="inline-error" role="alert">{error} <Link href="/admin/my-leaves" prefetch={false}>Thử lại</Link></div> : data && <section className="management-form personal-leaves">
      <form method="GET" action="/admin/my-leaves" className="commission-fields"><label>Tháng xem ngày nghỉ cá nhân<input type="month" name="month" defaultValue={data.month} required /></label><div><button>Xem tháng</button></div></form>
      <h2>Tháng {data.month}: {data.totalDays} ngày nghỉ</h2><LeaveRecordsTable items={data.items} />
      <div className="pagination"><span>Trang {data.page}/{Math.max(1,data.totalPages)} · {data.total} đợt nghỉ</span><div>{data.page > 1 && <Link href={href(data.page - 1)} prefetch={false}>← Trước</Link>}{data.page < data.totalPages && <Link href={href(data.page + 1)} prefetch={false}>Sau →</Link>}</div></div>
    </section>}
  </>;
}
