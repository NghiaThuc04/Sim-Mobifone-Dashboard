import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {projectRoot} from './postgres.mjs';
const fixture=JSON.parse(await readFile(join(projectRoot,'.local/ui-current.json'),'utf8'));
assert.equal(fixture.url,'http://127.0.0.1:3110');const checks=[];
function request(path,method='GET',cookie='',body,origin=fixture.url){return fetch(fixture.url+'/api/v1'+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function check(response,status,name){assert.equal(response.status,status,name);checks.push({name,status});return response;}
async function login(role){const account=fixture.accounts.find(item=>item.role===role);assert.equal(account.email,`ui-${role.toLowerCase()}@example.test`);return (await check(await request('/auth/login','POST','',{email:account.email,password:account.password}),200,role+' login')).headers.get('set-cookie').split(';')[0];}
const admin=await login('ADMIN');const staff=await login('STAFF');
const carrier=await (await check(await request('/admin/catalogs/carriers','POST',admin,{code:'ui-batch06-carrier',name:'UI kiểm thử nhà mạng'}),201,'create catalog carrier')).json();
const category=await (await check(await request('/admin/catalogs/sim-categories','POST',admin,{code:'ui-batch06-category',name:'UI kiểm thử loại SIM'}),201,'create catalog category')).json();
const base={carrierId:carrier.id,categoryId:category.id,costPrice:'70000',sellingPrice:'100000',visibilityRequested:true,stockStatus:'AVAILABLE'};
const sims=[];
for(const [phoneNumber,sellingPrice] of [['0001100001','100000'],['0001100002','70000'],['0001100003','60000']]){
 const sim=await (await check(await request('/admin/sims','POST',admin,{...base,phoneNumber,sellingPrice}),201,'create '+sellingPrice)).json();assert.equal(sim.isVisible,sellingPrice==='100000');sims.push(sim);
}
await check(await request('/admin/sims','POST',admin,{...base,phoneNumber:sims[0].phoneNumber}),409,'duplicate');
await check(await request('/admin/sims','POST',staff,{...base,phoneNumber:'0001100009'}),403,'STAFF create denied');
await check(await request('/admin/sims/'+sims[0].id,'PATCH',staff,{version:sims[0].version,sellingPrice:'120000'}),403,'STAFF patch denied');
await check(await request('/admin/sims/'+sims[0].id,'GET',staff),403,'STAFF admin detail denied');
const staffRows=await (await check(await request('/admin/sims?carrierId='+carrier.id,'GET',staff),200,'STAFF list')).json();assert(!JSON.stringify(staffRows).includes('costPrice'));assert.equal(staffRows.items.find(item=>item.id===sims[0].id).grossProfit,'30000');
await check(await request('/admin/sims'),401,'anonymous list denied');
let sim=sims[1];
for(const patch of [{sellingPrice:'100000',visibilityRequested:false},{sellingPrice:'60000'},{sellingPrice:'100000'}]){
 sim=await (await check(await request('/admin/sims/'+sim.id,'PATCH',admin,{...patch,version:sim.version}),200,'edit hidden price')).json();assert.equal(sim.isVisible,false);
}
const detail=await (await check(await request('/admin/sims/'+sim.id,'GET',admin),200,'price history')).json();assert.equal(detail.history.length,3);
const concurrent=await Promise.all([request('/admin/sims/'+sim.id,'PATCH',admin,{version:sim.version,sellingPrice:'110000'}),request('/admin/sims/'+sim.id,'PATCH',admin,{version:sim.version,sellingPrice:'120000'})]);assert.deepEqual(concurrent.map(item=>item.status).sort(),[200,409]);checks.push({name:'concurrent version conflict',status:409});
const filtered=await (await check(await request('/admin/sims?carrierId='+carrier.id+'&search=0001100001&minPrice=100000&maxPrice=100000&pageSize=1','GET',admin),200,'combined filters')).json();assert.equal(filtered.total,1);assert.equal(filtered.items[0].phoneNumber,'0001100001');
await check(await request('/admin/sims?minPrice=-1','GET',admin),400,'bad filter');
const mapping={phoneNumber:0,carrierCode:1,categoryCode:2,costPrice:3,sellingPrice:4};
const csv=`phone,carrier,category,cost,price\n0008877001,${carrier.code},${category.code},70000,100000\n0008877002,${carrier.code},${category.code},70000,60000\n0008877003,${carrier.code},${category.code},-1,100000`;
const body={filename:'fixture.csv',contentBase64:Buffer.from(csv).toString('base64')};
await check(await request('/admin/sim-imports/preview','POST',staff,body),403,'STAFF import denied');
await check(await request('/admin/sim-imports/preview','POST',admin,body),201,'upload mapping');
const preview=await (await check(await request('/admin/sim-imports/preview','POST',admin,{...body,mapping}),201,'validate preview')).json();
await check(await request('/admin/sim-imports/'+preview.id+'/confirm','POST',admin,{rows:[2,3]}),400,'price acceptance required');
const selection={rows:[2,3],acceptPriceErrors:true};const result=await (await check(await request('/admin/sim-imports/'+preview.id+'/confirm','POST',admin,selection),201,'confirm import')).json();assert.deepEqual([result.success,result.failed,result.skipped],[2,1,0]);
assert.deepEqual(await (await check(await request('/admin/sim-imports/'+preview.id+'/confirm','POST',admin,selection),201,'replay import')).json(),result);
await check(await request('/admin/alerts/sim-pricing','GET',admin),200,'P26 alerts available');await check(await request('/public/sims','GET',admin),404,'storefront absent');
const uiCsv=`phone,carrier,category,cost,price\n0009988001,${carrier.code},${category.code},70000,100000\n0009988002,${carrier.code},${category.code},70000,60000\n0009988003,${carrier.code},${category.code},-1,100000`;
await writeFile(join(projectRoot,'.local/batch06-ui-import.csv'),uiCsv,{mode:0o600});
await writeFile(join(projectRoot,'.local/batch06-ui-results.json'),JSON.stringify({createdAt:new Date().toISOString(),checks,sims,carrier,category}),{mode:0o600});
console.info('Batch 06 Next proxy checks passed: '+checks.length);
