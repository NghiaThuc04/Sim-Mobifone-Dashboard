import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { HttpFixture } from './helpers/http-fixture';
import { SimPricingService } from '../src/inventory/sim-pricing.service';
const f = new HttpFixture();
async function sample(sellingPrice:string, requested=true) {
  const carrier = await f.db.carrier.create({data:{code:randomUUID(),name:'Test carrier'}});
  const category = await f.db.simCategory.create({data:{code:randomUUID(),name:'Test category'}});
  return f.db.sim.create({data:{phoneNumber:String(Date.now()),carrierId:carrier.id,categoryId:category.id,costPrice:'70000',sellingPrice,visibilityRequested:requested}});
}
const reconcile = (id:string) => f.db.$transaction(tx=>f.app.get(SimPricingService).reconcile(tx,id,f.adminId));
test('P21 equal and below cost hide SIM, keep confirmed error separate and deduplicate open alert',async()=>{
  for(const price of ['70000','60000']) {
    const sim=await sample(price); await Promise.all([reconcile(sim.id),reconcile(sim.id)]);
    const current=await f.db.sim.findUniqueOrThrow({where:{id:sim.id}});
    assert.equal(current.hasPriceError,true);assert.equal(current.isVisible,false);assert.equal(current.errorConfirmedAt,null);
    assert.equal(await f.db.simPriceAlert.count({where:{simId:sim.id,resolvedAt:null}}),1);
    const alert=await f.db.simPriceAlert.findFirstOrThrow({where:{simId:sim.id}});assert.equal(alert.costSnapshot.toString(),'70000');assert.equal(alert.priceSnapshot.toString(),price);
  }
});
test('P21 valid price resolves alert and respects manual hidden or deleted state',async()=>{
  for(const requested of [true,false]) {
    const sim=await sample('60000',requested);await reconcile(sim.id);
    await f.db.sim.update({where:{id:sim.id},data:{sellingPrice:'100000'}});const fixed=await reconcile(sim.id);
    assert.equal(fixed.hasPriceError,false);assert.equal(fixed.isVisible,requested);
    assert.equal(await f.db.simPriceAlert.count({where:{simId:sim.id,resolvedAt:null}}),0);
    await f.db.sim.update({where:{id:sim.id},data:{deletedAt:new Date()}});assert.equal((await reconcile(sim.id)).isVisible,false);
  }
});
test('P21 pricing audit failure rolls back alert and flags atomically; no public SIM API',async()=>{
  const sim=await sample('70000');
  await f.db.$executeRaw`CREATE FUNCTION reject_price_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SIM_PRICE_CHECKED' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END; $$`;
  await f.db.$executeRaw`CREATE TRIGGER reject_price_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_price_audit()`;
  try {await assert.rejects(reconcile(sim.id));} finally {await f.db.$executeRaw`DROP TRIGGER reject_price_audit ON audit_logs`;await f.db.$executeRaw`DROP FUNCTION reject_price_audit()`;}
  assert.equal(await f.db.simPriceAlert.count({where:{simId:sim.id}}),0);
  for(const path of ['/public/sims','/public/sims/'+sim.id]) assert.equal((await f.get(path)).status,404);
});
