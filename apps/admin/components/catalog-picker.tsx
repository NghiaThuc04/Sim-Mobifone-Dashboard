'use client';
import { useEffect,useState } from 'react';
import type { CatalogKind,CatalogList } from '@sim-dashboard/shared';
import { apiRequest,ApiError } from '../lib/api-client';

export function CatalogPicker({kind,name,label,selected='',required=false}:{kind:CatalogKind;name:string;label:string;selected?:string;required?:boolean}) {
  const [search,setSearch]=useState('');const [page,setPage]=useState(1);const [value,setValue]=useState(selected);
  const [result,setResult]=useState<CatalogList>();const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();const timer=setTimeout(()=>{
      setLoading(true);setError('');
      apiRequest<CatalogList>(`/admin/catalogs/${kind}?pageSize=50&page=${page}&search=${encodeURIComponent(search)}`,{signal:controller.signal})
        .then(setResult).catch((error:unknown)=>{if(controller.signal.aborted)return;if(error instanceof ApiError&&error.status===401){window.location.replace('/login');return;}setError('Không tải được danh mục. Hãy thử đổi từ khóa.');})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },200);
    return()=>{clearTimeout(timer);controller.abort();};
  },[kind,page,search]);
  return <div className="catalog-picker"><label>{label}<select name={name} required={required} value={value} onChange={event=>setValue(event.target.value)}><option value="">{required?'Chọn danh mục':'Tất cả'}</option>
    {value&&!result?.items.some(item=>item.id===value)&&<option value={value}>{value} (đang chọn)</option>}{result?.items.map(item=><option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label>
    <label>Tìm {label.toLowerCase()}<input value={search} maxLength={100} onChange={event=>{setSearch(event.target.value);setPage(1);}} placeholder="Nhập tên hoặc mã" /></label>
    {loading&&<small role="status">Đang tải danh mục…</small>}{error&&<small role="alert">{error}</small>}
    {result&&result.totalPages>1&&<div className="form-actions"><button type="button" disabled={page<=1||loading} onClick={()=>setPage(page-1)}>Danh mục trước</button><small>{page}/{result.totalPages}</small><button type="button" disabled={page>=result.totalPages||loading} onClick={()=>setPage(page+1)}>Danh mục sau</button></div>}</div>;
}
