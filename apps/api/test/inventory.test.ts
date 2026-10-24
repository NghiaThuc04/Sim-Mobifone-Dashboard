import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomInt } from 'node:crypto';
import type { SimList } from '@sim-dashboard/shared';
import { PERMISSIONS } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
const f=new HttpFixture();
async function sample() {
 const carrier=await f.db.carrier.create({data:{code:randomUUID(),name:'Inventory test carrier'}});
 const category=await f.db.simCategory.create({data:{code:randomUUID(),name:'Inventory test category'}});
 for(const [phone,price,deletedAt] of [['0000123401','100000',null],['0000123402','120000',null],['0000123403','90000',new Date()]] as const)
  await f.db.sim.create({data:{phoneNumber:phone+String(randomInt(0,1000000000)),carrierId:carrier.id,categoryId:category.id,costPrice:'70000',sellingPrice:price,deletedAt}});
 return {carrier,category};
}
test('P22 ADMIN sees cost; STAFF DTO omits cost and honors revoked profits and inventory rights',async()=>{
 const {carrier}=await sample();const path='/admin/sims?carrierId='+carrier.id;
 const admin=await (await f.get(path)).json() as SimList;assert.equal(admin.items[0].costPrice,'70000');
 const staff=await (await f.get(path,f.staffCookie)).json() as SimList;assert(!JSON.stringify(staff).includes('costPrice'));assert.equal(staff.items.find(item=>item.sellingPrice==='100000')?.grossProfit,'30000');
 await f.db.employeePermission.create({data:{userId:f.staffId,permission:PERMISSIONS.PROFITS_VIEW,enabled:false,updatedBy:f.adminId}});
 assert(!JSON.stringify(await (await f.get(path,f.staffCookie)).json()).includes('grossProfit'));
 await f.db.employeePermission.create({data:{userId:f.staffId,permission:PERMISSIONS.SIMS_VIEW,enabled:false,updatedBy:f.adminId}});
 assert.equal((await f.get(path,f.staffCookie)).status,403);assert.equal((await f.get(path,'')).status,401);
});
test('P22 combined filters, active-only paging, empty and invalid queries',async()=>{
 const {carrier,category}=await sample();const path=`/admin/sims?carrierId=${carrier.id}&categoryId=${category.id}`;
 const data=await (await f.get(path+'&search=00001234&status=AVAILABLE&visibility=hidden&minPrice=100000&maxPrice=120000&pageSize=1')).json() as SimList;
 assert.equal(data.total,2);assert.equal(data.items.length,1);assert.equal(data.totalPages,2);
 const page2=await (await f.get(path+'&pageSize=1&page=2')).json() as SimList;assert.notEqual(page2.items[0].id,data.items[0].id);
 assert.equal((await (await f.get(path+'&search=999999')).json() as SimList).total,0);
 for(const query of ['page=0','minPrice=10&maxPrice=1','search=%25','status=UNKNOWN','costPrice=1','priceError=invalid']) assert.equal((await f.get('/admin/sims?'+query)).status,400);
});
