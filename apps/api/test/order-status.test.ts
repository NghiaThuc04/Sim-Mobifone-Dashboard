import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpFixture } from './helpers/http-fixture';
import { orderData } from './helpers/order-data';
const f=new HttpFixture();
test('P38 owner and ADMIN transitions; non-owner403; invalid/repeated status409; no unlock or completion',async()=>{
 const {order}=await orderData(f.db,f.adminId);const root='/admin/orders/'+order.id;
 assert.equal((await f.write(root+'/claim',{},'POST',f.staffCookie)).status,201);
 assert.equal((await f.write(root+'/status',{status:'CONFIRMED'},'PATCH',f.otherCookie)).status,403);
 for(const status of ['bad','PROCESSING','COMPLETED','CANCELLED'])assert.equal((await f.write(root+'/status',{status},'PATCH',f.staffCookie)).status,409);
 assert.equal((await f.write(root+'/status',{status:'CONFIRMED'},'PATCH',f.staffCookie)).status,200);
 assert.equal((await f.write(root+'/status',{status:'CONFIRMED'},'PATCH',f.staffCookie)).status,409);
 assert.equal((await f.write(root+'/status',{status:'PROCESSING'},'PATCH')).status,200);
 const saved=await f.db.order.findUniqueOrThrow({where:{id:order.id}});assert.equal(saved.assignedStaffId,f.staffId);assert(saved.claimedAt);assert.equal(saved.completedAt,null);
 const history=await f.db.orderStatusHistory.findMany({where:{orderId:order.id},orderBy:{createdAt:'asc'}});assert.equal(history.length,2);assert.equal(history[0].actorId,f.staffId);assert.equal(history[1].actorId,f.adminId);
 assert.equal(await f.db.auditLog.count({where:{targetId:order.id,action:'ORDER_STATUS_CHANGED'}}),2);
 await assert.rejects(f.db.orderStatusHistory.update({where:{id:history[0].id},data:{actorId:f.otherId}}));
});
test('P38 concurrent duplicate transition commits once and audit failure rolls back status/history',async()=>{
 const {order}=await orderData(f.db,f.adminId);const path='/admin/orders/'+order.id+'/status';
 const responses=await Promise.all(Array.from({length:8},()=>f.write(path,{status:'CONFIRMED'},'PATCH')));
 assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===409).length,7);
 await f.db.$executeRawUnsafe(`CREATE FUNCTION fail_status_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='ORDER_STATUS_CHANGED' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$`);
 await f.db.$executeRawUnsafe('CREATE TRIGGER fail_status_test BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_status_test()');
 try{assert.equal((await f.write(path,{status:'PROCESSING'},'PATCH')).status,503);assert.equal((await f.db.order.findUniqueOrThrow({where:{id:order.id}})).status,'CONFIRMED');assert.equal(await f.db.orderStatusHistory.count({where:{orderId:order.id}}),1);}
 finally{await f.db.$executeRawUnsafe('DROP TRIGGER fail_status_test ON audit_logs');await f.db.$executeRawUnsafe('DROP FUNCTION fail_status_test()');}
});
