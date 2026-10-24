import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
import { orderData } from './helpers/order-data';
import { hashSessionToken, sessionCookieName } from '../src/auth/session-token';
const f=new HttpFixture();
test('P37 twenty distinct STAFF race: exactly one owner/history/audit, own retry no duplicate',async()=>{
 const {order}=await orderData(f.db,f.adminId);const base=await f.db.user.findUniqueOrThrow({where:{id:f.staffId}});
 const cookies:string[]=[];const ids:string[]=[];
 for(let i=0;i<20;i++){const user=await f.db.user.create({data:{email:'race'+i+'@fixture.example.test',fullName:'Race '+i,role:'STAFF',passwordHash:base.passwordHash}});const token=randomBytes(32).toString('base64url');await f.db.authSession.create({data:{userId:user.id,tokenHash:hashSessionToken(token,f.config.SESSION_SECRET),expiresAt:new Date(Date.now()+60000)}});ids.push(user.id);cookies.push(sessionCookieName(false)+'='+token);}
 const path='/admin/orders/'+order.id+'/claim';
 const responses=await Promise.all(cookies.map(cookie=>f.write(path,{},'POST',cookie)));
 assert.equal(responses.filter(r=>r.status===201).length,1);assert.equal(responses.filter(r=>r.status===409).length,19);
 const winner=responses.findIndex(r=>r.status===201);const saved=await f.db.order.findUniqueOrThrow({where:{id:order.id}});assert.equal(saved.assignedStaffId,ids[winner]);assert(saved.claimedAt);
 assert.equal((await f.write(path,{},'POST',cookies[winner])).status,201);
 assert.equal(await f.db.orderAssignmentHistory.count({where:{orderId:order.id}}),1);assert.equal(await f.db.auditLog.count({where:{targetId:order.id,action:'ORDER_CLAIMED'}}),1);
 assert.equal((await f.write(path,{},'POST',f.staffCookie)).status,409);
});
test('P37 terminal, permission/session revocation, malicious actor/body, origin and rollback',async()=>{
 const {order}=await orderData(f.db,f.adminId);const path='/admin/orders/'+order.id+'/claim';
 assert.equal((await f.write(path,{assignedStaffId:f.otherId},'POST',f.staffCookie)).status,400);
 assert.equal((await f.write(path,{},'POST',f.staffCookie,'https://bad.example')).status,403);
 await f.db.employeePermission.create({data:{userId:f.staffId,permission:PERMISSIONS.ORDERS_CLAIM,enabled:false,updatedBy:f.adminId}});assert.equal((await f.write(path,{},'POST',f.staffCookie)).status,403);
 await f.db.user.update({where:{id:f.otherId},data:{status:'locked'}});assert.equal((await f.write(path,{},'POST',f.otherCookie)).status,401);
 await f.db.$executeRawUnsafe(`CREATE FUNCTION test_fail_claim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='ORDER_CLAIMED' THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END $$`);
 await f.db.$executeRawUnsafe('CREATE TRIGGER test_fail_claim BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_fail_claim()');
 try{assert.equal((await f.write(path,{})).status,503);assert.equal((await f.db.order.findUniqueOrThrow({where:{id:order.id}})).assignedStaffId,null);assert.equal(await f.db.orderAssignmentHistory.count({where:{orderId:order.id}}),0);}
 finally{await f.db.$executeRawUnsafe('DROP TRIGGER test_fail_claim ON audit_logs');await f.db.$executeRawUnsafe('DROP FUNCTION test_fail_claim()');}
 assert.equal((await f.write(path,{})).status,201);
 await f.db.order.update({where:{id:order.id},data:{status:'CANCELLED'}});assert.equal((await f.write(path,{})).status,409);
});
