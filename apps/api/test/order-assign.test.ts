import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { HttpFixture } from './helpers/http-fixture';
import { orderData } from './helpers/order-data';
const f=new HttpFixture();
test('P39 ADMIN alone transfers active STAFF, revokes old owner immediately, sticky beneficiary decision, unassign/reclaim',async()=>{
 const {order}=await orderData(f.db,f.adminId);const root='/admin/orders/'+order.id;
 await f.write(root+'/claim',{},'POST',f.staffCookie);
 for(const cookie of [f.staffCookie,f.otherCookie])assert.equal((await f.write(root+'/assign',{assignedStaffId:f.otherId},'POST',cookie)).status,403);
 assert.equal((await f.write(root+'/assign',{assignedStaffId:f.otherId,reason:'Đổi người xử lý'})).status,201);
 assert.equal((await f.write(root+'/status',{status:'CONFIRMED'},'PATCH',f.staffCookie)).status,403);
 assert.equal((await f.write(root+'/status',{status:'CONFIRMED'},'PATCH',f.otherCookie)).status,200);
 assert.equal((await f.write(root+'/claim',{},'POST',f.staffCookie)).status,409);
 const saved=await f.db.order.findUniqueOrThrow({where:{id:order.id}});assert.equal(saved.beneficiaryNeedsDecision,true);
 const history=await f.db.orderAssignmentHistory.findMany({where:{orderId:order.id,action:'ASSIGN'}});assert.equal(history.length,1);assert.equal(history[0].previousStaffId,f.staffId);assert.equal(history[0].assignedStaffId,f.otherId);assert.equal(history[0].actorId,f.adminId);assert.equal(history[0].reason,'Đổi người xử lý');
 assert.equal((await f.write(root+'/assign',{assignedStaffId:f.otherId})).status,201);assert.equal(await f.db.orderAssignmentHistory.count({where:{orderId:order.id,action:'ASSIGN'}}),1);
 assert.equal((await f.write(root+'/assign',{assignedStaffId:null})).status,201);assert.equal((await f.db.order.findUniqueOrThrow({where:{id:order.id}})).claimedAt,null);
 assert.equal((await f.write(root+'/status',{status:'PROCESSING'},'PATCH',f.otherCookie)).status,403);
 assert.equal((await f.write(root+'/claim',{},'POST',f.staffCookie)).status,201);assert.equal((await f.db.order.findUniqueOrThrow({where:{id:order.id}})).beneficiaryNeedsDecision,true);
});
test('P39 rejects locked/missing/ADMIN/unknown fields; audit error rolls back transfer/history',async()=>{
 const {order}=await orderData(f.db,f.adminId);const path='/admin/orders/'+order.id+'/assign';
 await f.db.user.update({where:{id:f.otherId},data:{status:'locked'}});
 for(const id of [f.otherId,f.adminId,randomUUID(),'invalid'])assert.equal((await f.write(path,{assignedStaffId:id})).status,400);
 assert.equal((await f.write(path,{assignedStaffId:f.staffId,beneficiaryId:f.staffId})).status,400);
 await f.db.$executeRawUnsafe(`CREATE FUNCTION fail_assign_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='ORDER_ASSIGNED' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$`);
 await f.db.$executeRawUnsafe('CREATE TRIGGER fail_assign_test BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_assign_test()');
 try{assert.equal((await f.write(path,{assignedStaffId:f.staffId})).status,503);assert.equal((await f.db.order.findUniqueOrThrow({where:{id:order.id}})).assignedStaffId,null);assert.equal(await f.db.orderAssignmentHistory.count({where:{orderId:order.id}}),0);}
 finally{await f.db.$executeRawUnsafe('DROP TRIGGER fail_assign_test ON audit_logs');await f.db.$executeRawUnsafe('DROP FUNCTION fail_assign_test()');}
});
