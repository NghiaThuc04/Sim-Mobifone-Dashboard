import Link from 'next/link';
import { ORDER_STATUSES, PERMISSIONS, type OrderList } from '@sim-dashboard/shared';
import { requireAccount } from '../../../lib/server-session';
import { serverApiRequest, redirectForAuthError } from '../../../lib/server-api';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAccount(PERMISSIONS.ORDERS_VIEW);
  const params = await searchParams; const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) { if (Array.isArray(value)) value.forEach(item => query.append(key, item)); else if (value) query.set(key, value); }
  const { data, error } = await serverApiRequest<OrderList>('/admin/orders?' + query); redirectForAuthError(error);
  const scalar = (key: string) => typeof params[key] === 'string' ? params[key] : '';
  const pageHref = (page: number) => { const next = new URLSearchParams(query); next.set('page', String(page)); return '/admin/orders?' + next; };
  return <>
    <div className="page-heading"><div><span className="eyebrow">THEO DÕI ĐƠN HÀNG</span><h1>Đơn hàng</h1>
      <p>Danh sách chỉ đọc. Mặc định tháng hiện tại theo giờ Việt Nam; chọn đủ hai ngày để thay khoảng tháng.</p></div></div>
    <form className="employee-filters" method="GET">
      <div><label htmlFor="orders-month">Tháng</label><input id="orders-month" name="month" type="month" defaultValue={scalar('month') || data?.month || ''} /></div>
      <div><label htmlFor="orders-status">Trạng thái</label><select id="orders-status" name="status" defaultValue={scalar('status')}><option value="">Tất cả</option>{ORDER_STATUSES.map(status => <option key={status}>{status}</option>)}</select></div>
      <div className="search-filter"><label htmlFor="order-code">Mã đơn chính xác</label><input id="order-code" name="orderCode" maxLength={64} defaultValue={scalar('orderCode')} /></div>
      <div><label htmlFor="order-phone">Số SIM chính xác</label><input id="order-phone" name="phoneNumber" inputMode="numeric" maxLength={32} defaultValue={scalar('phoneNumber')} /></div>
      <div><label htmlFor="order-from">Từ ngày</label><input id="order-from" name="fromDate" type="date" defaultValue={scalar('fromDate')} /></div>
      <div><label htmlFor="order-to">Đến hết ngày</label><input id="order-to" name="toDate" type="date" defaultValue={scalar('toDate')} /></div>
      <div><label htmlFor="order-staff">Mã nhân viên được giao</label><input id="order-staff" name="assignedStaffId" maxLength={36} defaultValue={scalar('assignedStaffId')} /></div>
      <button>Lọc đơn hàng</button><Link href="/admin/orders" prefetch={false}>Đặt lại</Link>
    </form>
    {error ? <div className="inline-error" role="alert">{error} <Link href="/admin/orders" prefetch={false}>Thử lại</Link></div> : data &&
      <section className="table-panel"><div className="table-caption"><strong>Danh sách đơn</strong><span>{data.total} đơn</span></div>
        {data.items.length ? <div className="table-scroll"><table><thead><tr><th>Mã đơn / Ngày tạo</th><th>Khách hàng</th><th>SIM đầu tiên / Số lượng</th><th>Giá bán snapshot</th>{data.canViewCost && <th>Giá gốc snapshot</th>}<th>Trạng thái</th><th>Người giữ đơn</th></tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id}><td className="wrap-cell"><Link href={'/admin/orders/' + item.id} prefetch={false}><strong>{item.orderCode}</strong></Link><p>{new Date(item.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p></td>
            <td>{item.customerName}</td><td>{item.firstItem?.phoneNumber ?? 'Chưa có chi tiết'}<p>{item.itemCount} SIM{item.itemCount > 1 ? ' · chỉ xem trước SIM đầu tiên' : ''}</p></td>
            <td>{item.firstItem?.sellingPrice ?? '—'}</td>{data.canViewCost && <td>{item.firstItem?.costPrice ?? '—'}</td>}
            <td><span className="status-badge">{item.status}</span></td><td className="wrap-cell">{item.isLocked ? 'Đã khóa' : 'Chưa khóa'}{item.assignedStaff && <p>{item.assignedStaff.fullName ?? 'Tài khoản không còn khả dụng'}<br /><small>{item.assignedStaff.id}</small></p>}</td>
          </tr>)}</tbody></table></div> : <div className="table-empty"><h2>Không có đơn phù hợp</h2><p>Chưa có đơn trong kỳ hoặc bộ lọc chưa tìm thấy kết quả.</p></div>}
        <div className="pagination"><span>Trang {data.page}/{Math.max(1, data.totalPages)} · {data.total} đơn</span><div>{data.page > 1 && <Link href={pageHref(data.page - 1)} prefetch={false}>← Trước</Link>}{data.page < data.totalPages && <Link href={pageHref(data.page + 1)} prefetch={false}>Sau →</Link>}</div></div>
      </section>}
  </>;
}
