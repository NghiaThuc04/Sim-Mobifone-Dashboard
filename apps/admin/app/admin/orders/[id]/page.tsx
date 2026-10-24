import Link from 'next/link';
import { OrderAssignment } from './order-assignment';
import { OrderActions } from './order-actions';
import { notFound } from 'next/navigation';
import { PERMISSIONS, type OrderDetail } from '@sim-dashboard/shared';
import { requireAccount } from '../../../../lib/server-session';
import { serverApiRequest, redirectForAuthError } from '../../../../lib/server-api';
export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await requireAccount(PERMISSIONS.ORDERS_VIEW);
  const { id } = await params; const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) { if (Array.isArray(value)) value.forEach(v => query.append(key, v)); else if (value) query.set(key, value); }
  const { data, error } = await serverApiRequest<OrderDetail>('/admin/orders/' + encodeURIComponent(id) + '?' + query);
  redirectForAuthError(error); if (error === 'not_found') notFound();
  const time = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  return <div className="order-detail"><Link href="/admin/orders" prefetch={false}>← Danh sách đơn</Link>
    <h1>Chi tiết đơn {data?.orderCode}</h1>
    {error && <div className="inline-error" role="alert">{error} <Link href={'/admin/orders/' + encodeURIComponent(id)} prefetch={false}>Thử lại</Link></div>}
    {data && <>
      <section className="table-panel"><h2>Khách hàng và xử lý</h2><p>{data.customer.fullName} · {data.customer.phone}</p>
        <p>Trạng thái: <strong>{data.status}</strong></p><p>{data.assignedStaff ? 'Đã khóa · ' + (data.assignedStaff.fullName ?? data.assignedStaff.id) : 'Chưa có người nhận'}</p>
        <OrderActions order={data} account={account} />{account.role === "ADMIN" && <OrderAssignment id={data.id} />}{data.beneficiaryNeedsDecision && <p role="status">Người hưởng hoa hồng CHƯA CHỐT — cần ADMIN quyết định, chưa tự phân bổ.</p>}</section>
      <section className="table-panel"><h2>SIM và giá tại lúc tạo đơn</h2>
        {data.items.length ? <div className="table-scroll"><table><thead><tr><th>Số SIM</th><th>Giá bán snapshot</th>{data.canViewCost && <th>Giá vốn snapshot</th>}</tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id}><td>{item.phoneNumber}</td><td>{item.sellingPrice}</td>{data.canViewCost && <td>{item.costPrice}</td>}</tr>)}</tbody></table></div> : <p>Không có chi tiết ở trang này.</p>}
        <div className="pagination"><span>{data.itemTotal} SIM · trang {data.itemPage}</span>
          {data.itemPage > 1 && <Link href={'?itemPage=' + (data.itemPage - 1)}>← Trước</Link>}{data.itemPage * 50 < Math.max(data.itemTotal, data.assignmentTotal, data.statusTotal) && <Link href={'?itemPage=' + (data.itemPage + 1)}>Sau →</Link>}</div></section>
      {data.completion && <section className="table-panel"><h2>Snapshot khi hoàn thành</h2><p>Duyệt: {data.completion.approvalStatus} — chưa ghi nhận hoặc chi hoa hồng.</p>
        <p>Tỷ lệ người xử lý tại thời điểm hoàn thành: {data.completion.rateSnapshot === null ? 'Chưa có chính sách áp dụng' : data.completion.rateSnapshot + '%'} · mã nhân viên {data.completion.rateEmployeeId ?? 'Chưa xác định'}</p>
        <p>Người hưởng: {data.completion.beneficiaryState === 'UNRESOLVED' ? 'CHƯA CHỐT — cần ADMIN quyết định' : data.completion.beneficiaryId}</p>
        <p>Snapshot tỷ lệ không tự phân bổ hoa hồng; thay đổi chính sách sau hoàn thành không sửa tỷ lệ này.</p></section>}
      <section className="table-panel"><h2>Lịch sử sẵn có</h2><p>{data.statusTotal} sự kiện trạng thái · trang {data.itemPage}</p>{data.statusHistory.map(event => <p key={event.id}>{time(event.createdAt)} · {event.previousStatus} → {event.status} · actor {event.actorId}</p>)}<p>{data.assignmentTotal} sự kiện phân công · trang {data.itemPage}</p>{data.assignmentHistory.map(event => <p key={event.id}>{time(event.createdAt)} · {event.action} · {event.previousStaffId ?? "Chưa giao"} → {event.assignedStaffId ?? "Chưa giao"} · actor {event.actorId}{event.reason && " · " + event.reason}</p>)}<p>Tạo đơn: {time(data.createdAt)}</p>
        {data.claimedAt && <p>Nhận đơn: {time(data.claimedAt)}</p>}{data.completedAt && <p>Hoàn thành: {time(data.completedAt)} · {data.completedBy}</p>}</section>
    </>}
  </div>;
}
