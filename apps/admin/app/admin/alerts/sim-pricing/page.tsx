import Link from 'next/link';
import { PERMISSIONS, type PriceAlertList } from '@sim-dashboard/shared';
import { requireAccount } from '../../../../lib/server-session';
import { serverApiRequest, redirectForAuthError } from '../../../../lib/server-api';

export default async function PriceAlertsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAccount(PERMISSIONS.CHECK_SIM_VIEW);
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value) query.set(key, value);
  }
  const { data, error } = await serverApiRequest<PriceAlertList>('/admin/alerts/sim-pricing?' + query);
  redirectForAuthError(error);
  const pageHref = (page: number) => { const next = new URLSearchParams(query); next.set('page', String(page)); return '/admin/alerts/sim-pricing?' + next; };
  return <>
    <div className="page-heading"><div><span className="eyebrow">KIỂM SOÁT GIÁ</span><h1>Cảnh báo SIM</h1>
      <p>Giá bán không cao hơn giá gốc. Cảnh báo tự động không phải xác nhận SIM lỗi để xóa.</p></div>
      {data && <span className="status-badge">{data.openCount} cảnh báo chưa xử lý</span>}</div>
    <form className="employee-filters" method="GET"><div><label htmlFor="alert-status">Trạng thái cảnh báo</label>
      <select id="alert-status" name="status" defaultValue={typeof params.status === 'string' ? params.status : 'open'}>
        <option value="open">Chưa xử lý</option><option value="resolved">Đã sửa giá</option><option value="all">Tất cả</option>
      </select></div><button>Lọc cảnh báo</button><Link href="/admin/alerts/sim-pricing" prefetch={false}>Đặt lại</Link></form>
    {error ? <div className="inline-error" role="alert">{error} <Link href="/admin/alerts/sim-pricing" prefetch={false}>Thử lại</Link></div> : data &&
      <section className="table-panel"><div className="table-caption"><strong>Lịch sử cảnh báo giá</strong><span>{data.total} cảnh báo</span></div>
        {data.items.length ? <div className="table-scroll"><table><thead><tr><th>Số SIM</th><th>Giá bán lúc cảnh báo</th>
          {data.canViewCost && <th>Giá gốc lúc cảnh báo</th>}{data.canViewDifference && <th>Chênh lệch bán − gốc</th>}
          <th>Phát hiện</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.items.map(item => <tr key={item.id}>
            <td><strong>{item.phoneNumber}</strong>{item.deletedAt && <p>Đã rời kho hoạt động</p>}</td><td>{item.sellingPrice}</td>
            {data.canViewCost && <td>{item.costPrice}</td>}{data.canViewDifference && <td>{item.difference}</td>}
            <td>{new Date(item.detectedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
            <td>{item.resolvedAt ? 'Đã sửa giá' : 'Chưa xử lý'}</td><td>{data.canViewCost && !item.deletedAt ?
              <Link href={'/admin/inventory/' + item.simId} prefetch={false}>Sửa giá</Link> : '—'}</td>
          </tr>)}</tbody></table></div> : <div className="table-empty"><h2>Không có cảnh báo phù hợp</h2><p>Chưa có cảnh báo hoặc bộ lọc chưa có kết quả.</p></div>}
        <div className="pagination"><span>Trang {data.page}/{Math.max(1, data.totalPages)} · {data.total} cảnh báo</span><div>
          {data.page > 1 && <Link href={pageHref(data.page - 1)} prefetch={false}>← Trước</Link>}
          {data.page < data.totalPages && <Link href={pageHref(data.page + 1)} prefetch={false}>Sau →</Link>}
        </div></div></section>}
  </>;
}
