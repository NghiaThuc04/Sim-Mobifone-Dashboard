import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomInt } from 'node:crypto';
import { HttpFixture } from './helpers/http-fixture';
const f=new HttpFixture();
async function input() {
 const carrier=await f.db.carrier.create({data:{code:randomUUID(),name:'Test carrier'}});const category=await f.db.simCategory.create({data:{code:randomUUID(),name:'Test category'}});
 return {phoneNumber:'00'+randomInt(0,1000000000),carrierId:carrier.id,categoryId:category.id,costPrice:'70000',sellingPrice:'100000',visibilityRequested:true};
}
test('P23 ADMIN creates SIM with leading zero, exact gross profit, audit and duplicate arbitration',async()=>{
 const body=await input();const created=await f.write('/admin/sims',body);assert.equal(created.status,201);const sim=await created.json() as {id:string;phoneNumber:string;grossProfit:string;isVisible:boolean};
 assert.equal(sim.phoneNumber,body.phoneNumber);assert.equal(sim.grossProfit,'30000');assert.equal(sim.isVisible,true);
 assert.equal(await f.db.auditLog.count({where:{targetId:sim.id,action:'SIM_CREATED',actorId:f.adminId}}),1);
 assert.equal((await f.write('/admin/sims',body)).status,409);
 const another={...body,phoneNumber:body.phoneNumber+'1'};assert.deepEqual((await Promise.all([f.write('/admin/sims',another),f.write('/admin/sims',another)])).map(r=>r.status).sort(),[201,409]);
});
test('P23 invalid price creates hidden alert; fields, references, Origin and ADMIN-only enforced',async()=>{
 const body=await input();for(const price of ['70000','60000']) {const result=await f.write('/admin/sims',{...body,phoneNumber:body.phoneNumber+price,sellingPrice:price});assert.equal(result.status,201);const sim=await result.json() as {id:string;isVisible:boolean;hasPriceError:boolean};assert.equal(sim.isVisible,false);assert.equal(sim.hasPriceError,true);assert.equal(await f.db.simPriceAlert.count({where:{simId:sim.id,resolvedAt:null}}),1);}
 for(const changes of [{phoneNumber:'x'},{costPrice:'-1'},{carrierId:randomUUID()},{role:'ADMIN'}])assert.equal((await f.write('/admin/sims',{...body,...changes})).status,400);
 assert.equal((await f.write('/admin/sims',body,'POST',f.staffCookie)).status,403);assert.equal((await f.write('/admin/sims',body,'POST','')).status,401);assert.equal((await f.write('/admin/sims',body,'POST',f.adminCookie,'')).status,403);
});
test('P23 failed creation audit rolls back SIM and pricing alert',async()=>{
 const body=await input();await f.db.$executeRaw`CREATE FUNCTION reject_sim_create() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SIM_CREATED' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END; $$`;
 await f.db.$executeRaw`CREATE TRIGGER reject_sim_create BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_sim_create()`;
 try{assert.equal((await f.write('/admin/sims',{...body,sellingPrice:'60000'})).status,503);}finally{await f.db.$executeRaw`DROP TRIGGER reject_sim_create ON audit_logs`;await f.db.$executeRaw`DROP FUNCTION reject_sim_create()`;}
 assert.equal(await f.db.sim.count({where:{phoneNumber:body.phoneNumber}}),0);
});
