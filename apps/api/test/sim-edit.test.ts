import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomInt } from 'node:crypto';
import { SimListItem,SimDetails } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
const f=new HttpFixture();
async function sample() {
 const carrier=await f.db.carrier.create({data:{code:randomUUID(),name:'Test carrier'}});const category=await f.db.simCategory.create({data:{code:randomUUID(),name:'Test category'}});
 return await (await f.write('/admin/sims',{phoneNumber:'00'+randomInt(0,1000000000),carrierId:carrier.id,categoryId:category.id,costPrice:'70000',sellingPrice:'100000',visibilityRequested:true})).json() as SimListItem;
}
const path=(id:string)=>'/admin/sims/'+id;
test('P24 price edits hide, resolve, retain manual hiding and append before/after audit history',async()=>{
 let sim=await sample();const id=sim.id;
 for(const changes of [{sellingPrice:'60000'},{sellingPrice:'100000',visibilityRequested:false},{sellingPrice:'120000',visibilityRequested:true}]) {
  const result=await f.write(path(id),{...changes,version:sim.version},'PATCH');assert.equal(result.status,200);sim=await result.json() as SimListItem;
  assert.equal(sim.hasPriceError,changes.sellingPrice==='60000');assert.equal(sim.isVisible,changes.visibilityRequested===true);
 }
 assert.equal(await f.db.simPriceAlert.count({where:{simId:id,resolvedAt:null}}),0);
 const detail=await (await f.get(path(id))).json() as SimDetails;assert.equal(detail.history.length,3);
 assert.equal(detail.history[2].before.sellingPrice,'100000');assert.equal(detail.history[2].after.sellingPrice,'60000');
 const change=await f.db.simChange.findFirstOrThrow({where:{simId:id}});await assert.rejects(f.db.simChange.delete({where:{id:change.id}}));
 assert.equal(await f.db.auditLog.count({where:{targetId:id,action:'SIM_UPDATED'}}),3);
});
test('P24 version conflicts have one winner; ADMIN-only, input/refs and archived protections',async()=>{
 const sim=await sample();const requests=await Promise.all(['110000','120000'].map(sellingPrice=>f.write(path(sim.id),{sellingPrice,version:sim.version},'PATCH')));assert.deepEqual(requests.map(r=>r.status).sort(),[200,409]);
 assert.equal(await f.db.simChange.count({where:{simId:sim.id}}),1);
 assert.equal((await f.write(path(sim.id),{sellingPrice:'1',version:sim.version},'PATCH',f.staffCookie)).status,403);assert.equal((await f.get(path(sim.id),f.staffCookie)).status,403);
 for(const changes of [{costPrice:'-1',version:1},{version:1,errorConfirmedAt:new Date().toISOString()},{sellingPrice:'1'}])assert.equal((await f.write(path(sim.id),changes,'PATCH')).status,400);
 const current=await f.db.sim.findUniqueOrThrow({where:{id:sim.id}});assert.equal((await f.write(path(sim.id),{carrierId:randomUUID(),version:current.version},'PATCH')).status,400);
 await f.db.sim.update({where:{id:sim.id},data:{deletedAt:new Date()}});assert.equal((await f.write(path(sim.id),{sellingPrice:'1',version:current.version},'PATCH')).status,404);
});
test('P24 failed audit rolls back price, alert and history',async()=>{
 const sim=await sample();await f.db.$executeRaw`CREATE FUNCTION reject_sim_update() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SIM_UPDATED' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END; $$`;
 await f.db.$executeRaw`CREATE TRIGGER reject_sim_update BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_sim_update()`;
 try{assert.equal((await f.write(path(sim.id),{sellingPrice:'60000',version:sim.version},'PATCH')).status,503);}finally{await f.db.$executeRaw`DROP TRIGGER reject_sim_update ON audit_logs`;await f.db.$executeRaw`DROP FUNCTION reject_sim_update()`;}
 assert.equal((await f.db.sim.findUniqueOrThrow({where:{id:sim.id}})).sellingPrice.toString(),'100000');assert.equal(await f.db.simChange.count({where:{simId:sim.id}}),0);assert.equal(await f.db.simPriceAlert.count({where:{simId:sim.id}}),0);
});
test('P24 PATCH does not apply creation defaults to omitted visibility and stock fields',async()=>{
 const sim=await sample();await f.db.sim.update({where:{id:sim.id},data:{stockStatus:'RESERVED'}});
 const result=await f.write(path(sim.id),{sellingPrice:'110000',version:sim.version},'PATCH');assert.equal(result.status,200);
 const updated=await result.json() as SimListItem;assert.equal(updated.stockStatus,'RESERVED');assert.equal(updated.visibilityRequested,true);assert.equal(updated.isVisible,true);
});
