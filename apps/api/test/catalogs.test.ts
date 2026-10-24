import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CatalogList } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
import { AUDIT_ACTIONS } from '../src/audit/audit.service';
const f=new HttpFixture();
const code=()=> 'test-'+randomUUID();
test('P19 ADMIN CRUD both catalogs, STAFF reads only, and all changes are audited',async()=>{
  for(const kind of ['carriers','sim-categories']) {
    const path='/admin/catalogs/'+kind;
    const response=await f.write(path,{code:code().toUpperCase(),name:'Danh mục kiểm thử'});assert.equal(response.status,201);
    const item=await response.json() as {id:string;code:string};assert.equal(item.code,item.code.toLowerCase());
    assert.equal((await f.get(path,f.staffCookie)).status,200);
    assert.equal((await f.write(path,{code:code(),name:'Denied'},'POST',f.staffCookie)).status,403);
    assert.equal((await f.write(path+'/'+item.id,{code:item.code,name:'Đã sửa'},'PUT')).status,200);
    assert.equal((await f.write(path+'/'+item.id,{},'DELETE',f.staffCookie)).status,403);
    assert.equal((await f.write(path+'/'+item.id,{},'DELETE')).status,204);
    const events=await f.db.auditLog.findMany({where:{targetId:item.id},orderBy:{createdAt:'asc'}});
    assert.deepEqual(events.map((event)=>event.action),[AUDIT_ACTIONS.CATALOG_CREATED,AUDIT_ACTIONS.CATALOG_UPDATED,AUDIT_ACTIONS.CATALOG_DELETED]);
    assert(events.every((event)=>event.actorId===f.adminId));
  }
});
test('P19 normalizes codes, rejects duplicates/races/bad input and supports Unicode search and paging',async()=>{
  const path='/admin/catalogs/carriers';const input={code:code(),name:'Nhân mạng kiểm thử'};
  const responses=await Promise.all([f.write(path,input),f.write(path,{...input,code:input.code.toUpperCase()})]);assert.deepEqual(responses.map((r)=>r.status).sort(),[201,409]);
  const list=await (await f.get(path+'?search='+encodeURIComponent('NHÂN MẠNG')+'&pageSize=1')).json() as CatalogList;assert(list.total>=1);assert.equal(list.items.length,1);
  for(const body of [{code:'bad code',name:'X'},{code:code(),name:' '},{...input,costPrice:'1'}])assert.equal((await f.write(path,body)).status,400);
  assert.equal((await f.get(path+'?page=0')).status,400);assert.equal((await f.get(path,'')).status,401);
  assert.equal((await f.get('/admin/catalogs/unknown')).status,404);
});
test('P19 failed audit rolls back catalog insertion',async()=>{
  const value=code();await f.db.$executeRaw`CREATE FUNCTION reject_catalog_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'CATALOG_CREATED' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`;
  await f.db.$executeRaw`CREATE TRIGGER reject_catalog_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_catalog_audit()`;
  try{assert.equal((await f.write('/admin/catalogs/carriers',{code:value,name:'Rollback test'})).status,503);}
  finally{await f.db.$executeRaw`DROP TRIGGER reject_catalog_audit ON audit_logs`;await f.db.$executeRaw`DROP FUNCTION reject_catalog_audit()`;}
  assert.equal(await f.db.carrier.count({where:{code:value}}),0);
});
