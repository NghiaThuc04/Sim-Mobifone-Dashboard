'use client';
import { useState,type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SIM_IMPORT_LIMITS,SIM_IMPORT_FIELDS,type SimImportField,type SimImportMapping,type SimImportPreview,type SimImportResult } from '@sim-dashboard/shared';
import { apiRequest,ApiError } from '../lib/api-client';
const labels:Record<SimImportField,string>={phoneNumber:'Số SIM',carrierCode:'Mã nhà mạng',categoryCode:'Mã loại SIM',costPrice:'Giá gốc',sellingPrice:'Giá bán',stockStatus:'Tồn kho (tùy chọn)',visibilityRequested:'Hiển thị true/false (tùy chọn)'};
export function SimImport() {
 const router=useRouter();const [file,setFile]=useState<{filename:string;contentBase64:string}>();const [sheet,setSheet]=useState(0);const [mapping,setMapping]=useState<Partial<Record<SimImportField,number>>>({});
 const [columns,setColumns]=useState<SimImportMapping>();const [preview,setPreview]=useState<SimImportPreview>();const [selected,setSelected]=useState<number[]>([]);const [accept,setAccept]=useState(false);
 const [result,setResult]=useState<SimImportResult>();const [pending,setPending]=useState(false);const [message,setMessage]=useState('');
 function failure(error:unknown){if(error instanceof ApiError&&error.status===401){window.location.replace('/login');return;}setMessage(error instanceof ApiError&&error.status===410?'Preview hết hạn; hãy upload và kiểm tra lại.':error instanceof ApiError&&error.status===409?'Preview đã được xác nhận với lựa chọn khác hoặc đã có 5 preview chờ xử lý. Kiểm tra kết quả trước khi thử lại.':'Không thể xử lý. Kiểm tra file, mapping, lựa chọn và quyền. Không nhập lại nếu chưa kiểm tra kết quả.');}
 async function upload(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const input=new FormData(event.currentTarget).get('file');if(!(input instanceof File)||!input.size||input.size>SIM_IMPORT_LIMITS.fileBytes){setMessage('Chọn CSV/XLSX tối đa 512 KiB.');return;}
  setPending(true);setMessage('');setPreview(undefined);setResult(undefined);setSelected([]);setMapping({});setAccept(false);
  try {
   const contentBase64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(input);});
   const file={filename:input.name,contentBase64};setFile(file);setSheet(0);setColumns(await apiRequest<SimImportMapping>('/admin/sim-imports/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...file,sheetIndex:0})}));
  }catch(error){failure(error);}finally{setPending(false);}
 }
 async function inspect(withMapping:boolean) {
  if(!file)return;setPending(true);setMessage('');setPreview(undefined);setResult(undefined);setSelected([]);setAccept(false);
  try {
   const response=await apiRequest<SimImportMapping|SimImportPreview>('/admin/sim-imports/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...file,sheetIndex:sheet,...(withMapping?{mapping}:{})})});
   if(response.phase==='preview')setPreview(response);else{setColumns(response);setMapping({});}
  }catch(error){failure(error);}finally{setPending(false);}
 }
 async function confirm() {
  if(!preview)return;setPending(true);setMessage('');
  try {setResult(await apiRequest<SimImportResult>(`/admin/sim-imports/${preview.id}/confirm`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:selected,acceptPriceErrors:accept})}));router.refresh();}
  catch(error){failure(error);}finally{setPending(false);}
 }
 return <section className="management-form sim-import"><h2>Import SIM CSV/XLSX — ADMIN</h2><p>CSV UTF-8 hoặc XLSX; tối đa 512 KiB, 500 dòng, 30 cột. Số SIM Excel phải là Text; giá số nguyên an toàn hoặc Text thập phân. Không chấp nhận công thức. Dùng mã danh mục đã tạo. Mặc định AVAILABLE và ẩn nếu không mapping hai cột tùy chọn.</p>
  <form onSubmit={upload} className="commission-fields"><label>File nhập SIM<input type="file" name="file" accept=".csv,.xlsx" required disabled={pending} onChange={()=>{setFile(undefined);setColumns(undefined);setPreview(undefined);setResult(undefined);setSelected([]);setMapping({});setAccept(false);}} /></label><div className="form-actions"><button disabled={pending}>Upload và xem cột</button></div></form>
  {columns&&<><p>{columns.rowsCount} dòng dữ liệu. Mapping cột theo tên và vị trí; preview tối đa 30 phút.</p>{columns.sheets.length>1&&<div className="commission-fields"><label>Sheet<select value={sheet} onChange={event=>{setSheet(Number(event.target.value));setPreview(undefined);setMapping({});}}>{columns.sheets.map((name,index)=><option key={index} value={index}>{name}</option>)}</select></label><button type="button" disabled={pending} onClick={()=>inspect(false)}>Đọc sheet đã chọn</button></div>}
   <div className="import-mapping">{SIM_IMPORT_FIELDS.map(field=><label key={field}>{labels[field]}<select value={mapping[field]??''} disabled={pending||!!preview} onChange={event=>setMapping({...mapping,[field]:event.target.value===''?undefined:Number(event.target.value)})}><option value="">Chưa chọn</option>{columns.columns.map((name,index)=><option key={index} value={index}>{index+1}. {name}</option>)}</select></label>)}</div>
   <div className="form-actions"><button disabled={pending} onClick={()=>inspect(true)}>Kiểm tra dữ liệu theo mapping</button></div><details><summary>Mẫu các dòng đầu file</summary><div className="table-scroll"><table><thead><tr>{columns.columns.map((name,index)=><th key={index}>{name}</th>)}</tr></thead><tbody>{columns.sample.map((row,index)=><tr key={index}>{row.map((cell,column)=><td key={column}>{cell}</td>)}</tr>)}</tbody></table></div></details></>}
  {preview&&<><p>Chọn rõ các dòng muốn nhập. Dòng lỗi không thể chọn. Giá bán ≤ giá gốc là cảnh báo: chỉ nhập ở trạng thái ẩn nếu được xác nhận.</p><label className="import-check"><input type="checkbox" disabled={pending||!!result} checked={selected.length>0&&selected.length===preview.rows.filter(row=>!row.errors.length).length} onChange={event=>setSelected(event.target.checked?preview.rows.filter(row=>!row.errors.length).map(row=>row.row):[])} />Chọn tất cả dòng hợp lệ</label>
   <div className="table-scroll"><table><thead><tr><th>Chọn</th><th>Dòng</th><th>Số SIM</th><th>Giá gốc / bán</th><th>Kiểm tra</th></tr></thead><tbody>{preview.rows.map(row=><tr key={row.row}><td><input aria-label={'Chọn dòng '+row.row} type="checkbox" disabled={pending||!!result||!!row.errors.length} checked={selected.includes(row.row)} onChange={event=>setSelected(event.target.checked?[...selected,row.row]:selected.filter(value=>value!==row.row))} /></td><td>{row.row}</td><td>{row.phoneNumber}</td><td>{row.costPrice} / {row.sellingPrice}</td><td className="wrap-cell">{row.errors.join(' ')||(row.priceWarning?'Lỗi giá: nhập ở trạng thái ẩn.':'Hợp lệ')}</td></tr>)}</tbody></table></div>
   <label className="import-check"><input type="checkbox" disabled={pending||!!result} checked={accept} onChange={event=>setAccept(event.target.checked)} />Tôi đồng ý nhập các dòng lỗi giá đã chọn ở trạng thái ẩn và tạo cảnh báo.</label>
   <div className="form-actions"><button disabled={pending||!!result||!selected.length||(preview.rows.some(row=>selected.includes(row.row)&&row.priceWarning)&&!accept)} onClick={confirm}>Xác nhận import {selected.length} dòng</button></div></>}
  {pending&&<p role="status">Đang xử lý…</p>}{message&&<p role="alert">{message}</p>}{result&&<div role="status"><h3>Kết quả import</h3><p>Thành công: {result.success} · Lỗi: {result.failed} · Bỏ qua: {result.skipped}</p><div className="table-scroll"><table><thead><tr><th>Dòng</th><th>Kết quả</th><th>Chi tiết</th></tr></thead><tbody>{result.items.map(row=><tr key={row.row}><td>{row.row}</td><td>{row.outcome}</td><td className="wrap-cell">{row.message}</td></tr>)}</tbody></table></div></div>}
 </section>;
}
