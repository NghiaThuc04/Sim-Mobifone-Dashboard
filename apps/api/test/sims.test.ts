import { test,beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomInt } from 'node:crypto';
import { HttpFixture } from './helpers/http-fixture';
import { calculateGrossProfit } from '../src/inventory/sim-pricing';
const f=new HttpFixture();let carrierId:string;let categoryId:string;
beforeEach(async()=>{
  carrierId=(await f.db.carrier.create({data:{code:'sim-test-'+randomUUID(),name:'Isolated SIM test carrier'}})).id;
  categoryId=(await f.db.simCategory.create({data:{code:'sim-test-'+randomUUID(),name:'Isolated SIM test category'}})).id;
});
const data=()=>({phoneNumber:'0'+String(randomInt(0,1000000000)).padStart(9,'0'),carrierId,categoryId,costPrice:'70',sellingPrice:'100',createdBy:f.adminId});
test('P20 SIM preserves leading zeros and exact numeric values, with safe defaults',async()=>{
  const price='123456789.123456789012345678901234567891';
  const sim=await f.db.sim.create({data:{...data(),phoneNumber:'0012345678',costPrice:price,sellingPrice:price}});
  assert.equal(sim.phoneNumber,'0012345678');assert.equal(sim.costPrice.toString(),price);assert.equal(sim.sellingPrice.toString(),price);
  assert.equal(sim.stockStatus,'AVAILABLE');assert.equal(sim.isVisible,false);assert.equal(sim.version,1);
});
test('P20 partial uniqueness allows one active phone only, including concurrent inserts and archived history',async()=>{
  const input=data();const results=await Promise.allSettled([f.db.sim.create({data:input}),f.db.sim.create({data:input})]);
  assert.equal(results.filter((r)=>r.status==='fulfilled').length,1);
  const original=await f.db.sim.findFirstOrThrow({where:{phoneNumber:input.phoneNumber,deletedAt:null}});
  await f.db.sim.update({where:{id:original.id},data:{deletedAt:new Date()}});
  await f.db.sim.create({data:input});
  assert.equal(await f.db.sim.count({where:{phoneNumber:input.phoneNumber}}),2);
  assert.equal(await f.db.sim.count({where:{phoneNumber:input.phoneNumber,deletedAt:null}}),1);
});
test('P20 database rejects negative/NaN prices, bad phone, foreign keys and invalid stock status',async()=>{
  for(const override of [{costPrice:'-1'},{sellingPrice:'-1'},{costPrice:'NaN'},{phoneNumber:'not-a-phone'},{carrierId:randomUUID()},{categoryId:randomUUID()}]) await assert.rejects(f.db.sim.create({data:{...data(),...override}}));
  const sim=await f.db.sim.create({data:data()});
  await assert.rejects(f.db.$executeRaw`UPDATE sims SET stock_status='INVALID' WHERE id=${sim.id}::uuid`);
  await assert.rejects(f.db.$executeRaw`UPDATE sims SET version=0 WHERE id=${sim.id}::uuid`);
});
test('P20 price visibility guard is independent from inventory status',async()=>{
  for(const sellingPrice of ['69','70']) await assert.rejects(f.db.sim.create({data:{...data(),sellingPrice,isVisible:true}}));
  const sold=await f.db.sim.create({data:{...data(),stockStatus:'SOLD',isVisible:true}});assert.equal(sold.isVisible,true);
  const underpriced=await f.db.sim.create({data:{...data(),sellingPrice:'69'}});assert.equal(underpriced.isVisible,false);
  assert.equal((await f.get('/public/sims',f.staffCookie)).status,404);
});
test('P20 catalogs referenced by SIM cannot be deleted through ADMIN API',async()=>{
  await f.db.sim.create({data:data()});
  assert.equal((await f.write('/admin/catalogs/carriers/'+carrierId,{},'DELETE')).status,409);
  assert.equal((await f.write('/admin/catalogs/sim-categories/'+categoryId,{},'DELETE')).status,409);
  assert(await f.db.carrier.findUnique({where:{id:carrierId}}));assert(await f.db.simCategory.findUnique({where:{id:categoryId}}));
});
test('P20 version is usable for atomic conditional updates; gross profit is exact and does not expose prices in API',async()=>{
  const sim=await f.db.sim.create({data:data()});
  const changes=await Promise.all([1,2].map(()=>f.db.sim.updateMany({where:{id:sim.id,version:1},data:{stockStatus:'RESERVED',version:{increment:1}}})));
  assert.deepEqual(changes.map((item)=>item.count).sort(),[0,1]);
  assert.equal(calculateGrossProfit('70','100'),'30');assert.equal(calculateGrossProfit('100','70'),'-30');
  assert.equal(calculateGrossProfit('0.123456789012345678901234567890','0.123456789012345678901234567891'),'0.000000000000000000000000000001');
  assert.throws(()=>calculateGrossProfit('-1','2'));
});
