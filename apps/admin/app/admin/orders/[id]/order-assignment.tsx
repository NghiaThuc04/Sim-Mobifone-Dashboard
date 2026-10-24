'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EmployeeList } from '@sim-dashboard/shared';
import { apiRequest, ApiError } from '../../../../lib/api-client';
export function OrderAssignment({id}:{id:string}) {
 const router=useRouter();const [list,setList]=useState<EmployeeList|null>(null);const [selected,setSelected]=useState('');const [reason,setReason]=useState('');const [pending,setPending]=useState(false);const [message,setMessage]=useState('');
 const fail=(error:unknown)=>{if(error instanceof ApiError&&error.status===401)window.location.replace('/login');else setMessage(error instanceof ApiError&&error.status===403?'Chỉ ADMIN được chuyển đơn.':error instanceof ApiError&&error.status===400?'Người nhận không còn hợp lệ. Hãy tải lại danh sách.':'Không thể xử lý. Vui lòng thử lại.');};
 async function load(page=1){setPending(true);setMessage('');try{setList(await apiRequest<EmployeeList>('/admin/employees?role=STAFF&status=active&pageSize=20&page='+page));}catch(error){fail(error);}finally{setPending(false);}}
 async function assign(){setPending(true);setMessage('');try{await apiRequest('/admin/orders/'+id+'/assign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assignedStaffId:selected||null,reason})});router.refresh();setMessage('Đã cập nhật người xử lý.');}catch(error){fail(error);}finally{setPending(false);}}
 return <section><h2>ADMIN chuyển người xử lý</h2><button disabled={pending} onClick={()=>void load()}>Tải STAFF đang hoạt động</button>
  {list&&<><label htmlFor="order-assignee">Người nhận mới</label><select id="order-assignee" disabled={pending} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Trả về chưa có người nhận</option>{list.items.map(staff=><option value={staff.id} key={staff.id}>{staff.fullName} · {staff.email}</option>)}</select>
    {!list.items.length&&<p>Không có STAFF đang hoạt động ở trang này.</p>}<p>Trang {list.page}/{Math.max(1,list.totalPages)} · đã chọn {selected||'chưa giao'}</p>
    {list.page>1&&<button disabled={pending} onClick={()=>void load(list.page-1)}>← Trang STAFF trước</button>}{list.page<list.totalPages&&<button disabled={pending} onClick={()=>void load(list.page+1)}>Trang STAFF sau →</button>}
    <label htmlFor="order-assign-reason">Lý do (không bắt buộc)</label><input id="order-assign-reason" maxLength={500} value={reason} disabled={pending} onChange={e=>setReason(e.target.value)} />
    <button disabled={pending} onClick={()=>void assign()}>Xác nhận chuyển người xử lý</button></>}
   {pending&&<p role="status">Đang xử lý…</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
