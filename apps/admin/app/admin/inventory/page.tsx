import Link from 'next/link';
import { PERMISSIONS,SimList,SIM_STOCK_STATUSES,USER_ROLES,hasPermission } from '@sim-dashboard/shared';
import { requireAccount } from '../../../lib/server-session';
import { serverApiRequest,redirectForAuthError } from '../../../lib/server-api';
import { CatalogPicker } from '../../../components/catalog-picker';
import { SimForm } from '../../../components/sim-form';
import { SimImport } from '../../../components/sim-import';

export default async function InventoryPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const actor=await requireAccount(PERMISSIONS.SIMS_VIEW);const params=await searchParams;const query=new URLSearchParams();
  for(const [key,value] of Object.entries(params)){if(Array.isArray(value))value.forEach(item=>query.append(key,item));else if(value)query.set(key,value);}
  const {data,error}=await serverApiRequest<SimList>('/admin/sims?'+query);redirectForAuthError(error);
  const scalar=(key:string)=>typeof params[key]==='string'?params[key]:'';
  const pageHref=(page:number)=>{const next=new URLSearchParams(query);next.set('page',String(page));return '/admin/inventory?'+next;};
  return <><div className="page-heading"><div><span className="eyebrow">KHO SỐ NỘI BỘ</span><h1>Kho SIM</h1><p>Dữ liệu kho hiện tại. Lợi nhuận gộp = giá bán − giá gốc; chưa tính hoa hồng hoặc phí.</p></div></div>
    {actor.role===USER_ROLES.ADMIN&&<details className="inventory-tools"><summary>Thêm SIM thủ công</summary><SimForm /></details>}
    {actor.role===USER_ROLES.ADMIN&&<details className="inventory-tools"><summary>Import SIM CSV/XLSX</summary><SimImport /></details>}
    {actor.role===USER_ROLES.STAFF&&hasPermission(actor,PERMISSIONS.SIMS_CREATE)&&<section className="management-form" role="status"><h2>Chức năng đăng SIM: cần cấu hình quy trình</h2><p>Đang chờ chốt nguồn số, cách nhập, quyền nhập giá và quy trình duyệt. Chưa thể gửi SIM vào kho.</p></section>}
    <form className="employee-filters" method="GET"><div className="search-filter"><label htmlFor="sim-search">Tìm số SIM</label><input id="sim-search" name="search" inputMode="numeric" maxLength={32} defaultValue={scalar('search')} /></div>
      <CatalogPicker key={'carrier'+scalar('carrierId')} kind="carriers" name="carrierId" label="Nhà mạng" selected={scalar('carrierId')} />
      <CatalogPicker key={'category'+scalar('categoryId')} kind="sim-categories" name="categoryId" label="Loại SIM" selected={scalar('categoryId')} />
      <div><label htmlFor="stock-filter">Tồn kho</label><select id="stock-filter" name="status" defaultValue={scalar('status')}><option value="">Tất cả</option>{SIM_STOCK_STATUSES.map(status=><option key={status}>{status}</option>)}</select></div>
      <div><label htmlFor="visible-filter">Hiển thị</label><select id="visible-filter" name="visibility" defaultValue={scalar('visibility')}><option value="">Tất cả</option><option value="visible">Đang hiển thị</option><option value="hidden">Đang ẩn</option></select></div>
      <div><label htmlFor="price-min">Giá bán từ</label><input id="price-min" name="minPrice" inputMode="decimal" defaultValue={scalar('minPrice')} /></div><div><label htmlFor="price-max">Đến giá</label><input id="price-max" name="maxPrice" inputMode="decimal" defaultValue={scalar('maxPrice')} /></div>
      <button>Lọc kho SIM</button><Link className="reset-filters" href="/admin/inventory" prefetch={false}>Đặt lại</Link></form>
    {error?<div className="inline-error" role="alert">{error} <Link href="/admin/inventory" prefetch={false}>Thử lại</Link></div>:data&&<section className="table-panel"><div className="table-caption"><strong>Kho SIM hoạt động</strong><span>{data.total} số</span></div>
      {data.items.length?<div className="table-scroll"><table><thead><tr><th>Số SIM</th><th>Nhà mạng / Loại SIM</th><th>Giá bán</th>{data.canViewCost&&<th>Giá gốc</th>}{data.canViewProfit&&<th>Lợi nhuận gộp</th>}<th>Tồn kho</th><th>Hiển thị</th><th>Lỗi giá</th></tr></thead><tbody>{data.items.map(item=><tr key={item.id}><td>{data.canViewCost?<Link href={`/admin/inventory/${item.id}`} prefetch={false}><strong>{item.phoneNumber} · Sửa</strong></Link>:<strong>{item.phoneNumber}</strong>}</td><td>{item.carrier.name} / {item.category.name}</td><td>{item.sellingPrice}</td>{data.canViewCost&&<td>{item.costPrice}</td>}{data.canViewProfit&&<td>{item.grossProfit}</td>}<td>{item.stockStatus}</td><td>{item.isVisible?'Hiển thị':'Đang ẩn'}</td><td>{item.hasPriceError?'Cần sửa giá':'Hợp lệ'}</td></tr>)}</tbody></table></div>:<div className="table-empty"><h2>Không có SIM phù hợp</h2><p>Kho chưa có dữ liệu hoặc bộ lọc chưa tìm thấy kết quả.</p></div>}
      <div className="pagination"><span>Trang {data.page}/{Math.max(1,data.totalPages)} · {data.total} số</span><div>{data.page>1&&<Link href={pageHref(data.page-1)} prefetch={false}>← Trước</Link>}{data.page<data.totalPages&&<Link href={pageHref(data.page+1)} prefetch={false}>Sau →</Link>}</div></div></section>}</>;
}

