import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomInt } from 'node:crypto';
import { Workbook } from 'exceljs';
import { SimImportPreview,SimImportResult,SIM_IMPORT_LIMITS } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
import { parseImportFile } from '../src/imports/import-parser';
const f=new HttpFixture();const previewPath='/admin/sim-imports/preview';
const mapping={phoneNumber:0,carrierCode:1,categoryCode:2,costPrice:3,sellingPrice:4};
const encoded=(text:string)=>({filename:'test.csv',contentBase64:Buffer.from(text).toString('base64'),mapping});
async function fixture() {
 const carrier=await f.db.carrier.create({data:{code:'test-'+randomUUID(),name:'Import test carrier'}});const category=await f.db.simCategory.create({data:{code:'test-'+randomUUID(),name:'Import test category'}});
 const prefix='00'+randomInt(0,1000000000);return {carrier,category,prefix,header:'phone,carrier,category,cost,price',row:(suffix:string,price='100000')=>`${prefix+suffix},${carrier.code},${category.code},70000,${price}`};
}
test('P25 CSV mixed preview requires explicit valid selection and price acceptance; reports, leading zeros and replay are correct',async()=>{
 const data=await fixture();const body=encoded([data.header,data.row('1'),data.row('2','60000'),data.row('3','-1'),data.row('4'),data.row('4'),data.row('5')].join('\n'));
 const response=await f.write(previewPath,body);assert.equal(response.status,201);const preview=await response.json() as SimImportPreview;assert.equal(preview.rows.length,6);assert.equal(preview.rows[1].priceWarning,true);assert(preview.rows[2].errors.length);assert(preview.rows[3].errors.length);assert(preview.rows[4].errors.length);
 const path='/admin/sim-imports/'+preview.id+'/confirm';assert.equal((await f.write(path,{rows:[2,3]})).status,400);assert.equal((await f.write(path,{rows:[4],acceptPriceErrors:true})).status,400);
 const selected={rows:[2,3],acceptPriceErrors:true};const results=await Promise.all([f.write(path,selected),f.write(path,selected)]);assert(results.every(result=>result.status===201));const summary=await results[0].json() as SimImportResult;assert.deepEqual(await results[1].json(),summary);
 assert.deepEqual([summary.success,summary.failed,summary.skipped],[2,3,1]);assert.deepEqual(await (await f.write(path,selected)).json(),summary);
 assert.equal((await f.write(path,{rows:[2],acceptPriceErrors:false})).status,409);
 const sim=await f.db.sim.findFirstOrThrow({where:{phoneNumber:data.prefix+'2'}});assert.equal(sim.isVisible,false);assert.equal(sim.hasPriceError,true);assert.equal(sim.errorConfirmedAt,null);
 assert.equal(await f.db.sim.count({where:{phoneNumber:data.prefix+'5'}}),0);assert.equal(await f.db.auditLog.count({where:{targetId:preview.id,action:'SIM_IMPORTED'}}),1);
});
test('P25 XLSX Text preserves zeros and rejects numeric phone, formulas and unsupported cells',async()=>{
 const data=await fixture();const workbook=new Workbook();const sheet=workbook.addWorksheet('Import');sheet.addRow(['phone','carrier','category','cost','price']);
 sheet.addRow([data.prefix+'1',data.carrier.code,data.category.code,70000,100000]);sheet.addRow([123456789,data.carrier.code,data.category.code,70000,100000]);sheet.addRow([data.prefix+'3',data.carrier.code,data.category.code,70000,{formula:'70000+1',result:70001}]);
 const bytes=Buffer.from(await workbook.xlsx.writeBuffer());const response=await f.write(previewPath,{filename:'test.xlsx',contentBase64:bytes.toString('base64'),mapping});assert.equal(response.status,201);const preview=await response.json() as SimImportPreview;
 assert.equal(preview.rows[0].phoneNumber,data.prefix+'1');assert.equal(preview.rows[0].errors.length,0);assert(preview.rows[1].errors.some(error=>error.includes('Text')));assert(preview.rows[2].errors.length);
 assert.equal((await f.write('/admin/sim-imports/'+preview.id+'/confirm',{rows:[2]})).status,201);assert(await f.db.sim.findFirst({where:{phoneNumber:data.prefix+'1'}}));
 const malformed=Buffer.from('PK00broken');await assert.rejects(parseImportFile('test.xlsx',malformed,0));
});
test('P25 checks ownership, roles, expiry, mapping, file shape and bounded parsing',async()=>{
 const data=await fixture();const body=encoded(data.header+'\n'+data.row('1'));
 assert.equal((await f.write(previewPath,body,'POST',f.staffCookie)).status,403);assert.equal((await f.write(previewPath,body,'POST','')).status,401);
 for(const change of [{filename:'bad.exe'},{contentBase64:Buffer.from('empty').toString('base64')},{mapping:{...mapping,sellingPrice:3}},{mapping:{...mapping,sellingPrice:29}}])assert.equal((await f.write(previewPath,{...body,...change})).status,400);
 const preview=await (await f.write(previewPath,body)).json() as SimImportPreview;const path='/admin/sim-imports/'+preview.id+'/confirm';
 assert.equal((await f.write(path,{rows:[2]},'POST',f.staffCookie)).status,403);
 await f.db.user.update({where:{id:f.otherId},data:{role:'ADMIN'}});assert.equal((await f.write(path,{rows:[2]},'POST',f.otherCookie)).status,404);
 const batch=await f.db.simImportBatch.findUniqueOrThrow({where:{id:preview.id}});await f.db.simImportBatch.update({where:{id:preview.id},data:{expiresAt:new Date(batch.createdAt.getTime()+1)}});
 assert.equal((await f.write(path,{rows:[2]})).status,410);
 await assert.rejects(parseImportFile('test.csv',Buffer.alloc(SIM_IMPORT_LIMITS.fileBytes+1),0));await assert.rejects(parseImportFile('test.csv',Buffer.from('h\n'+Array(501).fill('v').join('\n')),0));
 const columns=await (await f.write(previewPath,{filename:body.filename,contentBase64:body.contentBase64})).json() as {phase:string;columns:string[]};assert.equal(columns.phase,'mapping');assert.equal(columns.columns.length,5);
});
test('P25 rejects expansion bombs and treats malformed database lookup values as row errors',async()=>{
 const workbook=new Workbook();workbook.addWorksheet('Bomb').addRow(['x'.repeat(SIM_IMPORT_LIMITS.uncompressedBytes+1)]);
 const compressed=Buffer.from(await workbook.xlsx.writeBuffer());assert(compressed.length<SIM_IMPORT_LIMITS.fileBytes);await assert.rejects(parseImportFile('test.xlsx',compressed,0));
 const data=await fixture();const response=await f.write(previewPath,encoded(data.header+'\n'+'001\u0000,invalid\u0000,invalid,70000,100000'));
 assert.equal(response.status,201);assert((await response.json() as SimImportPreview).rows[0].errors.length);
});
test('P25 handles duplicate created after preview and rolls back all selected rows on audit failure',async()=>{
 const data=await fixture();const body=encoded(data.header+'\n'+data.row('1')+'\n'+data.row('2'));
 const preview=await (await f.write(previewPath,body)).json() as SimImportPreview;
 await f.write('/admin/sims',{phoneNumber:data.prefix+'1',carrierId:data.carrier.id,categoryId:data.category.id,costPrice:'70000',sellingPrice:'100000'});
 const result=await (await f.write('/admin/sim-imports/'+preview.id+'/confirm',{rows:[2,3]})).json() as SimImportResult;assert.equal(result.success,1);assert.equal(result.failed,1);
 const next=await (await f.write(previewPath,encoded(data.header+'\n'+data.row('3')+'\n'+data.row('4','60000')))).json() as SimImportPreview;
 await f.db.$executeRaw`CREATE FUNCTION reject_import_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SIM_IMPORTED' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END; $$`;
 await f.db.$executeRaw`CREATE TRIGGER reject_import_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_import_audit()`;
 try{assert.equal((await f.write('/admin/sim-imports/'+next.id+'/confirm',{rows:[2,3],acceptPriceErrors:true})).status,503);}finally{await f.db.$executeRaw`DROP TRIGGER reject_import_audit ON audit_logs`;await f.db.$executeRaw`DROP FUNCTION reject_import_audit()`;}
 assert.equal(await f.db.sim.count({where:{phoneNumber:{in:[data.prefix+'3',data.prefix+'4']}}}),0);assert.equal((await f.db.simImportBatch.findUniqueOrThrow({where:{id:next.id}})).confirmedAt,null);
});
