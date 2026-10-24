import { BadRequestException,Injectable } from '@nestjs/common';
import { Account,PERMISSIONS,decimalUnits } from '@sim-dashboard/shared';
import { z } from 'zod';
import { AuthorizationService } from '../authorization/authorization.service';
import { simInput } from '../inventory/inventory.input';
import { parseImportFile } from './import-parser';
import { previewInput,confirmInput,type StoredRow } from './import.input';
import { SimImportRepository } from './import.repository';

@Injectable()
export class SimImportService {
 constructor(private readonly repository:SimImportRepository,private readonly authorization:AuthorizationService) {}
 async preview(body:unknown,actor:Account) {
  this.authorization.assertAllowed(actor,PERMISSIONS.SETTINGS_ADMIN);const parsed=previewInput.safeParse(body);if(!parsed.success)throw new BadRequestException('File hoặc mapping không hợp lệ.');
  const input=parsed.data;const sheet=await parseImportFile(input.filename,Buffer.from(input.contentBase64,'base64'),input.sheetIndex);
  if(!sheet.rows.length)throw new BadRequestException('File không có dòng dữ liệu.');
  if(!input.mapping)return {phase:'mapping',columns:sheet.columns,sample:sheet.rows.slice(0,10).map(row=>row.cells.map(cell=>cell.text)),rowsCount:sheet.rows.length,sheets:sheet.sheets};
  const mapping=input.mapping;if(Object.values(mapping).some(index=>index>=sheet.columns.length))throw new BadRequestException('Mapping vượt số cột trong file.');
  const cell=(row:typeof sheet.rows[number],key:keyof typeof mapping)=>{const index=mapping[key];return index===undefined?undefined:row.cells[index];};
  const text=(row:typeof sheet.rows[number],key:keyof typeof mapping)=>cell(row,key)?.text.trim()??'';
  const refs=await this.repository.references([...new Set(sheet.rows.map(row=>text(row,'carrierCode').toLowerCase()))],[...new Set(sheet.rows.map(row=>text(row,'categoryCode').toLowerCase()))],sheet.rows.map(row=>text(row,'phoneNumber')));
  const counts=new Map<string,number>();sheet.rows.forEach(row=>{const phone=text(row,'phoneNumber');counts.set(phone,(counts.get(phone)??0)+1);});
  const existing=new Set(refs.existing.map(item=>item.phoneNumber));
  const rows:StoredRow[]=sheet.rows.map(row=>{
   const errors:string[]=[];const phoneNumber=text(row,'phoneNumber');const costPrice=text(row,'costPrice');const sellingPrice=text(row,'sellingPrice');
   if(cell(row,'phoneNumber')?.kind!=='text')errors.push('Ô số SIM phải là Text; không tự đoán số 0 đã mất.');
   if(Object.keys(mapping).some(key=>cell(row,key as keyof typeof mapping)?.kind==='unsupported'))errors.push('Ô công thức hoặc kiểu dữ liệu không hỗ trợ.');
   if((counts.get(phoneNumber)??0)>1)errors.push('Trùng số SIM trong file.');if(existing.has(phoneNumber))errors.push('Số SIM đã có trong kho.');
   const carrierId=refs.carriers.find(item=>item.code===text(row,'carrierCode').toLowerCase())?.id;const categoryId=refs.categories.find(item=>item.code===text(row,'categoryCode').toLowerCase())?.id;
   if(!carrierId)errors.push('Mã nhà mạng không tồn tại.');if(!categoryId)errors.push('Mã loại SIM không tồn tại.');
   const visible=text(row,'visibilityRequested');if(mapping.visibilityRequested!==undefined&&!['true','false'].includes(visible))errors.push('Cột hiển thị chỉ nhận true hoặc false.');
   const data=simInput.safeParse({phoneNumber,carrierId,categoryId,costPrice,sellingPrice,stockStatus:mapping.stockStatus===undefined?'AVAILABLE':text(row,'stockStatus'),visibilityRequested:visible==='true'});
   if(!data.success)errors.push('Số SIM, giá, trạng thái hoặc danh mục không hợp lệ. Giá phải không âm và dùng số thập phân chính xác.');
   const valid=errors.length===0&&data.success;
   return {row:row.row,phoneNumber,costPrice,sellingPrice,errors,priceWarning:valid&&decimalUnits(sellingPrice)!<=decimalUnits(costPrice)!,data:valid?data.data:null};
  });
  const batch=await this.repository.savePreview(rows,actor.id);
  return {phase:'preview',id:batch.id,expiresAt:batch.expiresAt.toISOString(),rows:rows.map(({row,phoneNumber,costPrice,sellingPrice,errors,priceWarning})=>({row,phoneNumber,costPrice,sellingPrice,errors,priceWarning}))};
 }
 confirm(id:string,body:unknown,actor:Account) {
  this.authorization.assertAllowed(actor,PERMISSIONS.SETTINGS_ADMIN);const parsed=confirmInput.safeParse(body);
  if(!z.uuid().safeParse(id).success||!parsed.success)throw new BadRequestException('Lựa chọn import không hợp lệ.');
  return this.repository.confirm(id,parsed.data.rows,parsed.data.acceptPriceErrors,actor.id);
 }
}
