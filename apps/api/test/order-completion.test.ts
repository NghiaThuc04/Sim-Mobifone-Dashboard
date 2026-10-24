import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpFixture } from './helpers/http-fixture';
import { orderData } from './helpers/order-data';
import type { OrderDetail } from '@sim-dashboard/shared';
const f=new HttpFixture();
async function processing(cookie=f.staffCookie){const fixture=await orderData(f.db,f.adminId);const {order,sim}=fixture;
 await f.db.orderItem.create({data:{orderId:order.id,simId:sim.id,phoneNumberSnapshot:sim.phoneNumber,sellingPriceSnapshot:sim.sellingPrice,costPriceSnapshot:sim.costPrice}});
 const root='/admin/orders/'+order.id;assert.equal((await f.write(root+'/claim',{},'POST',cookie)).status,201);
 for(const status of ['CONFIRMED','PROCESSING'])assert.equal((await f.write(root+'/status',{status},'PATCH',cookie)).status,200);return {...fixture,root};}
async function rate(id:string,value:string,effectiveAt?:string){const response=await f.write('/admin/employees/'+id+'/commission-policy',{ratePercent:value,...(effectiveAt?{effectiveAt}:{})},'PUT');assert.equal(response.status,200);return await response.json() as {id:string};}
const finish=(root:string,cookie=f.staffCookie)=>f.write(root+'/status',{status:'COMPLETED'},'PATCH',cookie);
test('P40 rate effective exactly at completion, ADMIN acting for STAFF, no approval/payment; later policy cannot resnapshot',async()=>{
 const {root,order,sim}=await processing();await rate(f.staffId,'5',new Date(Date.now()-10000).toISOString());
 const exact='12.123456789012345678901234567891';const current=await rate(f.staffId,exact);await rate(f.staffId,'99',new Date(Date.now()+86400000).toISOString());
 assert.equal((await finish(root,f.otherCookie)).status,403);assert.equal((await finish(root,f.adminCookie)).status,200);
 const snapshot=await f.db.orderCompletion.findUniqueOrThrow({where:{orderId:order.id}});assert.equal(snapshot.rateSnapshot?.toString(),exact);assert.equal(snapshot.ratePolicyId,current.id);assert.equal(snapshot.rateEmployeeId,f.staffId);assert.equal(snapshot.completedBy,f.adminId);assert.equal(snapshot.beneficiaryId,f.staffId);assert.equal(snapshot.approvalStatus,'PENDING_APPROVAL');assert(!('commissionAmount'in snapshot));
 const saved=await f.db.order.findUniqueOrThrow({where:{id:order.id}});assert.equal(saved.completedAt?.toISOString(),snapshot.completedAt.toISOString());assert(snapshot.policyEffectiveAt!<=snapshot.completedAt);
 await rate(f.staffId,'35');assert.equal((await finish(root)).status,409);assert.deepEqual(await f.db.orderCompletion.findUniqueOrThrow({where:{orderId:order.id}}),snapshot);
 const item=await f.db.orderItem.findFirstOrThrow({where:{orderId:order.id}});assert.equal(item.costPriceSnapshot.toString(),sim.costPrice.toString());assert.equal(item.sellingPriceSnapshot.toString(),sim.sellingPrice.toString());
 await assert.rejects(f.db.orderCompletion.update({where:{orderId:order.id},data:{rateSnapshot:'35'}}));await assert.rejects(f.db.orderCompletion.delete({where:{orderId:order.id}}));await assert.rejects(f.db.$executeRaw`TRUNCATE order_completions`);
 await assert.rejects(f.db.order.update({where:{id:order.id},data:{completedBy:f.otherId}}));await assert.rejects(f.db.order.update({where:{id:order.id},data:{status:'PROCESSING',completedAt:null,completedBy:null}}));
 const other=await orderData(f.db,f.adminId);await assert.rejects(f.db.orderItem.create({data:{orderId:order.id,simId:other.sim.id,phoneNumberSnapshot:other.sim.phoneNumber,sellingPriceSnapshot:'1',costPriceSnapshot:'0'}}));
 assert.equal((await f.write(root+'/assign',{assignedStaffId:f.otherId})).status,201);assert.deepEqual(await f.db.orderCompletion.findUniqueOrThrow({where:{orderId:order.id}}),snapshot);
 const detail=await (await f.get(root)).json() as OrderDetail;assert.equal(detail.beneficiaryNeedsDecision,true);assert.equal(detail.completion?.beneficiaryState,'UNRESOLVED');assert.equal(detail.completion?.beneficiaryId,null);
});
test('P40 transferred order: handler rate has provenance, beneficiary unresolved; ADMIN/unassigned never gets ADMIN commission; absent rate stays null',async()=>{
 const a=await processing();await rate(f.staffId,'10');await rate(f.otherId,'20');await f.write(a.root+'/assign',{assignedStaffId:f.otherId});
 assert.equal((await finish(a.root)).status,403);assert.equal((await finish(a.root,f.otherCookie)).status,200);
 const moved=await f.db.orderCompletion.findUniqueOrThrow({where:{orderId:a.order.id}});assert.equal(moved.rateEmployeeId,f.otherId);assert.equal(moved.rateSnapshot?.toString(),'20');assert.equal(moved.beneficiaryState,'UNRESOLVED');assert.equal(moved.beneficiaryId,null);
 const b=await processing(f.adminCookie);assert.equal((await finish(b.root,f.adminCookie)).status,200);const admin=await f.db.orderCompletion.findUniqueOrThrow({where:{orderId:b.order.id}});assert.equal(admin.rateEmployeeId,null);assert.equal(admin.rateSnapshot,null);assert.equal(admin.beneficiaryId,null);
 const c=await processing(f.adminCookie);await f.write(c.root+'/assign',{assignedStaffId:null});assert.equal((await finish(c.root,f.adminCookie)).status,200);assert.equal((await f.db.orderCompletion.findUniqueOrThrow({where:{orderId:c.order.id}})).beneficiaryState,'UNRESOLVED');
});
test('P40 concurrent completion once, audit failure atomic rollback, no-detail and invalid transition rejected',async()=>{
 const a=await processing();await rate(f.staffId,'7');
 await f.db.$executeRawUnsafe(`CREATE FUNCTION fail_complete_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='ORDER_COMPLETED' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$`);
 await f.db.$executeRawUnsafe('CREATE TRIGGER fail_complete_test BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_complete_test()');
 try{assert.equal((await finish(a.root)).status,503);const saved=await f.db.order.findUniqueOrThrow({where:{id:a.order.id}});assert.equal(saved.status,'PROCESSING');assert.equal(saved.completedAt,null);assert.equal(await f.db.orderCompletion.count({where:{orderId:a.order.id}}),0);assert.equal(await f.db.orderStatusHistory.count({where:{orderId:a.order.id}}),2);}
 finally{await f.db.$executeRawUnsafe('DROP TRIGGER fail_complete_test ON audit_logs');await f.db.$executeRawUnsafe('DROP FUNCTION fail_complete_test()');}
 const responses=await Promise.all(Array.from({length:20},()=>finish(a.root)));assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===409).length,19);assert.equal(await f.db.auditLog.count({where:{targetId:a.order.id,action:'ORDER_COMPLETED'}}),1);
 const {order}=await orderData(f.db,f.adminId);const root='/admin/orders/'+order.id;assert.equal((await finish(root,f.adminCookie)).status,409);await f.db.order.update({where:{id:order.id},data:{status:'PROCESSING'}});assert.equal((await finish(root,f.adminCookie)).status,409);
 const noRate=await processing(f.otherCookie);assert.equal((await finish(noRate.root,f.otherCookie)).status,200);assert.equal((await f.db.orderCompletion.findUniqueOrThrow({where:{orderId:noRate.order.id}})).rateSnapshot,null);
});
