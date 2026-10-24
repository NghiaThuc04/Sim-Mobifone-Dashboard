import Link from 'next/link';
import { PERMISSIONS,type SimDetails } from '@sim-dashboard/shared';
import { requireAccount } from '../../../../lib/server-session';
import { serverApiRequest,redirectForAuthError } from '../../../../lib/server-api';
import { SimForm } from '../../../../components/sim-form';
export default async function EditSimPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 await requireAccount(PERMISSIONS.SETTINGS_ADMIN);const {id}=await params;const input=await searchParams;const query=new URLSearchParams();
 for(const [key,value]of Object.entries(input)){if(Array.isArray(value))value.forEach(item=>query.append(key,item));else if(value)query.set(key,value);}
 const {data,error}=await serverApiRequest<SimDetails>('/admin/sims/'+encodeURIComponent(id)+'?'+query);redirectForAuthError(error);
 return <><Link href="/admin/inventory" prefetch={false}>← Kho SIM</Link><div className="page-heading"><div><h1>Chỉnh sửa SIM</h1><p>Giữ lịch sử thay đổi; xung đột phiên bản phải tải lại. Chưa có module đơn hàng hoặc hoa hồng.</p></div></div>
  {error?<div role="alert" className="inline-error">{error}</div>:data&&<><SimForm initial={data.item} /><section className="management-form"><h2>Lịch sử thay đổi</h2>{data.history.length?data.history.map(change=><details key={change.id}><summary>{new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium'}).format(new Date(change.createdAt))} · {change.actorId}</summary><div className="table-scroll"><table><thead><tr><th>Trường</th><th>Trước</th><th>Sau</th></tr></thead><tbody>{Object.entries(change.before).map(([key,value])=><tr key={key}><td>{key}</td><td>{String(value)}</td><td>{String(change.after[key as keyof typeof change.after])}</td></tr>)}</tbody></table></div></details>):<p>Chưa có chỉnh sửa.</p>}<div className="pagination"><span>{data.total} lần · Trang {data.page}/{Math.max(1,data.totalPages)}</span><div>{data.page>1&&<Link href={`?page=${data.page-1}`}>← Trước</Link>}{data.page<data.totalPages&&<Link href={`?page=${data.page+1}`}>Sau →</Link>}</div></div></section></>}
 </>;
}
