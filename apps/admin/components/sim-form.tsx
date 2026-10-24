'use client';
import { useState,type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SIM_STOCK_STATUSES,NON_NEGATIVE_DECIMAL_PATTERN,type SimListItem } from '@sim-dashboard/shared';
import { apiRequest,ApiError } from '../lib/api-client';
import { CatalogPicker } from './catalog-picker';
export function SimForm({initial}:{initial?:SimListItem}) {
 const router=useRouter();const [pending,setPending]=useState(false);const [message,setMessage]=useState('');const [fields,setFields]=useState<Record<string,string>>({});const [reset,setReset]=useState(0);
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const form=new FormData(event.currentTarget);setPending(true);setMessage('');setFields({});
  try {
   const result=await apiRequest<SimListItem>('/admin/sims'+(initial?'/'+initial.id:''),{method:initial?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phoneNumber:form.get('phoneNumber'),carrierId:form.get('carrierId'),categoryId:form.get('categoryId'),costPrice:form.get('costPrice'),sellingPrice:form.get('sellingPrice'),stockStatus:form.get('stockStatus'),visibilityRequested:form.get('visibilityRequested')==='on',...(initial?{version:initial.version}:{})})});
   if(!initial)setReset(value=>value+1);setMessage(result.hasPriceError?'Đã lưu SIM nhưng bị ẩn do lỗi giá; đã cập nhật cảnh báo.':'Đã lưu SIM.');router.refresh();
  }catch(error){if(error instanceof ApiError){if(error.status===401){window.location.replace('/login');return;}setFields(error.fields);if(error.status===409){setMessage('Số trùng hoặc bản ghi đã thay đổi. Tải lại trước khi lưu tiếp.');return;}}setMessage('Chưa lưu được SIM. Kiểm tra dữ liệu, quyền và thử lại.');}finally{setPending(false);}
 }
 return <section className="management-form sim-form"><h2>{initial?'Chỉnh sửa SIM':'Thêm SIM thủ công'}</h2><form key={initial?initial.version:reset} onSubmit={submit} className="commission-fields">
  <label>Số SIM<input name="phoneNumber" required inputMode="numeric" pattern="[0-9]{1,32}" maxLength={32} defaultValue={initial?.phoneNumber} />{fields.phoneNumber&&<small role="alert">{fields.phoneNumber}</small>}</label>
  <CatalogPicker kind="carriers" name="carrierId" label="Nhà mạng" required selected={initial?.carrier.id} />{fields.carrierId&&<small role="alert">{fields.carrierId}</small>}
  <CatalogPicker kind="sim-categories" name="categoryId" label="Loại SIM" required selected={initial?.category.id} />{fields.categoryId&&<small role="alert">{fields.categoryId}</small>}
  <label>Giá gốc (VND)<input name="costPrice" required inputMode="decimal" pattern={NON_NEGATIVE_DECIMAL_PATTERN} maxLength={66} defaultValue={initial?.costPrice} />{fields.costPrice&&<small role="alert">{fields.costPrice}</small>}</label>
  <label>Giá bán (VND)<input name="sellingPrice" required inputMode="decimal" pattern={NON_NEGATIVE_DECIMAL_PATTERN} maxLength={66} defaultValue={initial?.sellingPrice} />{fields.sellingPrice&&<small role="alert">{fields.sellingPrice}</small>}</label>
  <label>Trạng thái tồn kho<select name="stockStatus" defaultValue={initial?.stockStatus??'AVAILABLE'}>{SIM_STOCK_STATUSES.map(status=><option key={status}>{status}</option>)}</select></label>
  <label className="schedule-option"><input type="checkbox" name="visibilityRequested" defaultChecked={initial?.visibilityRequested} />Cho phép hiển thị khi giá hợp lệ</label><small>Giá bán ≤ giá gốc: lưu SIM ở trạng thái ẩn và tạo cảnh báo. Không tự xác nhận SIM lỗi.</small>
  <div className="form-actions"><button type="submit" disabled={pending}>{pending?'Đang lưu…':initial?'Lưu chỉnh sửa SIM':'Tạo SIM'}</button>{initial&&<button type="button" onClick={()=>window.location.reload()}>Tải lại SIM</button>}</div></form>{message&&<p role="status">{message}</p>}</section>;
}
