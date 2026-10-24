'use client';
import { useState,type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CatalogKind,CatalogList,CatalogItem } from '@sim-dashboard/shared';
import { apiRequest,ApiError } from '../lib/api-client';

export function CatalogManager({ kind,title,result,pageKey }: {kind:CatalogKind;title:string;result:CatalogList;pageKey:string}) {
  const router=useRouter(); const [editing,setEditing]=useState<CatalogItem|null>(null);
  const [deleting,setDeleting]=useState<CatalogItem|null>(null); const [pending,setPending]=useState(false); const [message,setMessage]=useState('');
  function failure(error:unknown) {
    if(error instanceof ApiError && error.status===401){window.location.replace('/login');return;}
    setMessage(error instanceof ApiError && error.status===409 ? 'Mã đã tồn tại hoặc danh mục đang được SIM sử dụng.' : 'Không thể lưu thay đổi. Kiểm tra dữ liệu/quyền và thử lại.');
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setPending(true);setMessage('');
    try {await apiRequest(`/admin/catalogs/${kind}${editing ? '/'+editing.id : ''}`,{method:editing ? 'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:data.get('code'),name:data.get('name')})});form.reset();setEditing(null);setMessage('Đã lưu danh mục.');router.refresh();}
    catch(error){failure(error);}finally{setPending(false);}
  }
  async function remove() {
    if(!deleting)return;setPending(true);setMessage('');
    try {await apiRequest(`/admin/catalogs/${kind}/${deleting.id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:'{}'});setDeleting(null);setMessage('Đã xóa danh mục không được sử dụng.');router.refresh();}
    catch(error){failure(error);}finally{setPending(false);}
  }
  return <section className="management-form catalog-panel">
    <h2>{title}</h2><form onSubmit={submit} className="commission-fields" key={editing?.id ?? 'new'}>
      <h3>{editing ? 'Chỉnh sửa danh mục':'Thêm danh mục'}</h3>
      <label>{title} - Mã<input name="code" required maxLength={80} pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*" defaultValue={editing?.code ?? ''} placeholder="Mã không dấu, ngăn bằng dấu gạch ngang" /></label>
      <label>{title} - Tên<input name="name" required maxLength={150} defaultValue={editing?.name ?? ''} /></label>
      <div className="form-actions"><button disabled={pending} type="submit">{pending ? 'Đang lưu…':editing ? 'Lưu chỉnh sửa':'Thêm danh mục'}</button>{editing && <button type="button" disabled={pending} onClick={()=>setEditing(null)}>Hủy sửa</button>}</div>
    </form>
    {message && <p role="status">{message}</p>}
    {deleting && <div className="action-confirm"><p>Xóa danh mục “{deleting.name}”? Chỉ xóa được nếu không có SIM tham chiếu.</p><div className="form-actions"><button disabled={pending} onClick={remove}>Xác nhận xóa</button><button disabled={pending} onClick={()=>setDeleting(null)}>Hủy</button></div></div>}
    {result.items.length ? <div className="table-scroll"><table><thead><tr><th>Mã</th><th>Tên</th><th>Thao tác</th></tr></thead><tbody>{result.items.map((item)=><tr key={item.id}><td>{item.code}</td><td className="wrap-cell">{item.name}</td><td><div className="form-actions"><button disabled={pending} onClick={()=>{setEditing(item);setMessage('');}}>Sửa</button><button disabled={pending} onClick={()=>{setDeleting(item);setMessage('');}}>Xóa</button></div></td></tr>)}</tbody></table></div>:<p>Chưa có danh mục. Chưa nhập dữ liệu kinh doanh.</p>}
    <div className="pagination"><span>Trang {result.page}/{Math.max(1,result.totalPages)} · {result.total} danh mục</span><div>{result.page>1 && <Link href={`/admin/catalogs?${pageKey}=${result.page-1}`} prefetch={false}>← Trước</Link>}{result.page<result.totalPages && <Link href={`/admin/catalogs?${pageKey}=${result.page+1}`} prefetch={false}>Sau →</Link>}</div></div>
  </section>;
}
