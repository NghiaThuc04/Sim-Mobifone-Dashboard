import Link from 'next/link';
import { PERMISSIONS, type SimCheckResult, USER_ROLES } from '@sim-dashboard/shared';
import { requireAccount } from '../../../lib/server-session';
import { serverApiRequest, redirectForAuthError } from '../../../lib/server-api';
import { RemoveSimAction } from '../../../components/remove-sim-action';

export default async function CheckSimPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireAccount(PERMISSIONS.CHECK_SIM_VIEW);
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value) query.set(key, value);
  }
  const response = query.size ? await serverApiRequest<SimCheckResult>('/admin/check-sim?' + query) : {};
  redirectForAuthError(response.error);
  const item = response.data?.item;
  return <>
    <div className="page-heading"><div><span className="eyebrow">TRA CỨU NỘI BỘ</span><h1>Check SIM</h1>
      <p>Tìm chính xác số trong kho hoạt động. Các bản ghi đã rời kho vẫn được bảo toàn trong lịch sử.</p></div></div>
    <form method="GET" className="employee-filters"><div className="search-filter"><label htmlFor="check-phone">Số SIM cần kiểm tra</label>
      <input id="check-phone" name="phoneNumber" required inputMode="numeric" pattern="[0-9]{1,32}" maxLength={32} defaultValue={typeof params.phoneNumber === 'string' ? params.phoneNumber : ''} /></div>
      <button>Tra cứu SIM</button><Link href="/admin/check-sim" prefetch={false}>Đặt lại</Link></form>
    {response.error ? <div className="inline-error" role="alert">{response.error} <Link href="/admin/check-sim" prefetch={false}>Thử lại</Link></div> :
      item ? <section className="management-form sim-inspection"><div className="page-heading"><div><h2>{item.phoneNumber}</h2><p>{item.carrier.name} · {item.category.name}</p></div><span className="status-badge">{item.stockStatus}</span></div>
        <dl className="inspection-facts"><div><dt>Giá bán</dt><dd>{item.sellingPrice} VND</dd></div>
          {actor.role === USER_ROLES.ADMIN && <div><dt>Giá gốc</dt><dd>{item.costPrice} VND</dd></div>}
          {item.grossProfit !== undefined && <div><dt>Lợi nhuận gộp</dt><dd>{item.grossProfit} VND</dd></div>}
          <div><dt>Hiển thị</dt><dd>{item.isVisible ? 'Đang hiển thị' : 'Đang ẩn'}</dd></div>
          <div><dt>Cảnh báo giá tự động</dt><dd>{item.hasPriceError ? 'Giá cần sửa' : 'Không có'}</dd></div>
          <div><dt>Xác nhận SIM lỗi</dt><dd>Chưa có nguồn xác minh hợp lệ{item.errorConfirmation.recordedAt ? ' · Có mốc thời gian cũ, chưa đủ điều kiện xóa' : ''}</dd></div>
          <div><dt>Thông tin đơn hàng</dt><dd>Chưa tích hợp nguồn đối soát đơn vào Check SIM; chưa thể xác minh đơn hoặc trạng thái hoàn thành tại đây.</dd></div>
        </dl>
        <p className="rate-warning">{item.removal.allowed ? 'ADMIN được xóa khỏi kho hoạt động ở mọi trạng thái, giữ lịch sử.' : item.removal.reason === 'PERMISSION_DENIED' ? 'Tài khoản chưa có quyền xóa SIM.' : 'Chưa thể cho STAFF xóa: thiếu nguồn xác minh đơn COMPLETED hoặc xác nhận lỗi hợp lệ. SOLD hay giá sai không đủ điều kiện.'}</p>
        {actor.role === USER_ROLES.ADMIN && <Link href={'/admin/inventory/' + item.id} prefetch={false}>Xem lịch sử và chỉnh sửa SIM →</Link>}
        {actor.role === USER_ROLES.ADMIN && item.removal.allowed && <RemoveSimAction key={item.id + ':' + item.version} sim={item} />}
      </section> : <section className="table-panel table-empty"><h2>{response.data ? 'Không tìm thấy trong kho hoạt động' : 'Nhập số SIM để tra cứu'}</h2>
        <p>{response.data ? 'Số có thể chưa nhập hoặc đã rời kho hoạt động; kết quả này không khẳng định không có lịch sử.' : 'Nhập đầy đủ số, giữ nguyên số 0 đầu. Không dùng ký tự đại diện.'}</p></section>}
  </>;
}
