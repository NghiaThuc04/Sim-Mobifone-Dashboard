'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasPermission, ORDER_NEXT_STATUS, PERMISSIONS, type Account, type OrderDetail } from '@sim-dashboard/shared';
import { apiRequest, ApiError } from '../../../../lib/api-client';
export function OrderActions({order,account}:{order:OrderDetail;account:Account}) {
 const router=useRouter();const [pending,setPending]=useState(false);const [message,setMessage]=useState('');
 const next = ORDER_NEXT_STATUS[order.status];
 const canUpdate = (account.role === 'ADMIN' || order.assignedStaff?.id === account.id) && hasPermission(account,PERMISSIONS.ORDERS_UPDATE_OWN);
 async function updateStatus(){setPending(true);setMessage('');try{await apiRequest('/admin/orders/'+order.id+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next})});router.refresh();setMessage('Đã cập nhật trạng thái.');}
 catch(error){if(error instanceof ApiError&&error.status===401)window.location.replace('/login');else setMessage(error instanceof ApiError&&error.status===403?'Bạn không còn giữ đơn hoặc không có quyền cập nhật.':error instanceof ApiError&&error.status===409?'Trạng thái đã thay đổi. Hãy tải lại.':'Không thể cập nhật. Vui lòng thử lại.');router.refresh();}finally{setPending(false);}}
 async function claim(){setPending(true);setMessage('');try{await apiRequest('/admin/orders/'+order.id+'/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});router.refresh();setMessage('Đã nhận đơn.');}
 catch(error){if(error instanceof ApiError&&error.status===401)window.location.replace('/login');else setMessage(error instanceof ApiError&&error.status===409?'đơn đã có người nhận hoặc đã kết thúc. Hãy tải lại.':error instanceof ApiError&&error.status===403?'Bạn không có quyền nhận đơn.':'Không thể nhận đơn. Vui lòng thử lại.');router.refresh();}finally{setPending(false);}}
 return <div>{canUpdate && next && <><p>Luồng: PENDING → CONFIRMED → PROCESSING → COMPLETED. Hoàn thành chưa phải duyệt hoa hồng.</p><button disabled={pending} onClick={()=>void updateStatus()}>{next === 'COMPLETED' ? 'Hoàn thành đơn' : 'Chuyển sang ' + next}</button></>}{!order.assignedStaff&&!['COMPLETED','CANCELLED'].includes(order.status)&&hasPermission(account,PERMISSIONS.ORDERS_CLAIM)&&<button disabled={pending} onClick={()=>void claim()}>{pending?'Đang nhận…':'Nhận đơn'}</button>}{message&&<p role="status">{message}</p>}</div>;
}
