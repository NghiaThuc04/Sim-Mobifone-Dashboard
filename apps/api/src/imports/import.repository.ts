import { BadRequestException,ConflictException,GoneException,Injectable,NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SIM_IMPORT_LIMITS,type SimImportResult } from '@sim-dashboard/shared';
import { DatabaseService } from '../database/database.service';
import { AuditService,AUDIT_ACTIONS } from '../audit/audit.service';
import { SimWriteRepository } from '../inventory/sim-write.repository';
import { storedRows,resultSchema,type StoredRow } from './import.input';

@Injectable()
export class SimImportRepository {
 constructor(private readonly db:DatabaseService,private readonly writer:SimWriteRepository,private readonly audit:AuditService) {}
 async references(carrierCodes:string[],categoryCodes:string[],phones:string[]) {
  const validCode=(code:string)=>code.length<=80&&/^[a-z0-9]+(-[a-z0-9]+)*$/.test(code);
  const [carriers,categories,existing]=await Promise.all([
   this.db.carrier.findMany({where:{code:{in:carrierCodes.filter(validCode)}},select:{id:true,code:true}}),
   this.db.simCategory.findMany({where:{code:{in:categoryCodes.filter(validCode)}},select:{id:true,code:true}}),
   this.db.sim.findMany({where:{phoneNumber:{in:phones.filter(phone=>/^\d{1,32}$/.test(phone))},deletedAt:null},select:{phoneNumber:true}}),
  ]);return {carriers,categories,existing};
 }
 async savePreview(rows:StoredRow[],actorId:string) {
  return this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actorId},0))`;
   const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;
   await tx.simImportBatch.deleteMany({where:{createdBy:actorId,confirmedAt:null,expiresAt:{lt:now}}});
   if(await tx.simImportBatch.count({where:{createdBy:actorId,confirmedAt:null}})>=5)throw new ConflictException('Đã có 5 preview đang chờ; dùng preview hiện có hoặc chờ hết hạn.');
   return tx.simImportBatch.create({data:{createdBy:actorId,payload:rows,expiresAt:new Date(now.getTime()+SIM_IMPORT_LIMITS.previewMinutes*60000)},select:{id:true,expiresAt:true}});
  });
 }
 async confirm(id:string,selection:number[],acceptPriceErrors:boolean,actorId:string) {
  const selectionHash=createHash('sha256').update(JSON.stringify({rows:[...selection].sort((a,b)=>a-b),acceptPriceErrors})).digest('hex');
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM sim_import_batches WHERE id=${id}::uuid AND created_by=${actorId}::uuid FOR UPDATE`;
   const batch=await tx.simImportBatch.findFirst({where:{id,createdBy:actorId}});if(!batch)throw new NotFoundException('Preview not found.');
   if(batch.confirmedAt){if(batch.selectionHash!==selectionHash)throw new ConflictException('Preview đã được xác nhận với lựa chọn khác.');return resultSchema.parse(batch.result);}
   const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;if(batch.expiresAt<=now)throw new GoneException('Preview đã hết hạn; kiểm tra lại file.');
   const rows=storedRows.parse(batch.payload);const selected=new Set(selection);
   if(selection.some(row=>!rows.some(item=>item.row===row&&item.data&&item.errors.length===0)))throw new BadRequestException('Chỉ chọn dòng hợp lệ trong preview.');
   if(!acceptPriceErrors&&rows.some(row=>selected.has(row.row)&&row.priceWarning))throw new BadRequestException('Cần xác nhận rõ việc nhập SIM lỗi giá ở trạng thái ẩn.');
   const result:SimImportResult={success:0,failed:0,skipped:0,items:[]};
   for(const row of rows) {
    if(row.errors.length){result.failed++;result.items.push({row:row.row,outcome:'FAILED',message:row.errors.join(' ')});continue;}
    if(!selected.has(row.row)||!row.data){result.skipped++;result.items.push({row:row.row,outcome:'SKIPPED',message:'Không được chọn.'});continue;}
    // Catalog locks also handle deletion between preview and confirmation without aborting the batch.
    try {await this.writer.requireCatalogs(tx,row.data);}catch(error){if(!(error instanceof BadRequestException))throw error;result.failed++;result.items.push({row:row.row,outcome:'FAILED',message:'Danh mục đã thay đổi; kiểm tra lại.'});continue;}
    const sim=await this.writer.create(tx,row.data,actorId);
    if(!sim){result.failed++;result.items.push({row:row.row,outcome:'FAILED',message:'Số SIM đã có trong kho tại thời điểm xác nhận.'});continue;}
    result.success++;result.items.push({row:row.row,outcome:'IMPORTED',message:sim.hasPriceError?'Đã nhập và ẩn do lỗi giá.':'Đã nhập.',simId:sim.id});
   }
   await this.audit.append({actorKind:'USER',actorId,action:AUDIT_ACTIONS.SIM_IMPORTED,targetType:'SIM_IMPORT',targetId:id,metadata:{importSuccess:result.success,importFailed:result.failed,importSkipped:result.skipped}},tx);
   await tx.simImportBatch.update({where:{id},data:{confirmedAt:now,selectionHash,result}});
   return result;
  },{timeout:60000,maxWait:5000});
 }
}
