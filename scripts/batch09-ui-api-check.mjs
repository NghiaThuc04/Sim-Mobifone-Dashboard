import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const fixture=JSON.parse(await readFile(new URL('../.local/ui-current.json',import.meta.url),'utf8'));
assert.equal(fixture.url,'http://127.0.0.1:3110');const checks=[];
function request(path,method='GET',cookie='',body,origin=fixture.url){return fetch(fixture.url+'/api/v1'+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function check(response,status,name){assert.equal(response.status,status,name);checks.push({name,status});return response;}
async function login(role){const account=fixture.accounts.find(a=>a.role===role);return(await check(await request('/auth/login','POST','',{email:account.email,password:account.password}),200,role+' login')).headers.get('set-cookie').split(';')[0];}
const admin=await login('ADMIN'),staff=await login('STAFF');
const initial=await(await check(await request('/admin/orders','GET',admin),200,'empty orders')).json();assert.equal(initial.total,0);
const users=await(await check(await request('/admin/employees?role=STAFF&status=active','GET',admin),200,'active STAFF picker')).json();const staffId=(await(await request('/auth/me','GET',staff)).json()).user.id;
const other=users.items.find(u=>u.id!==staffId);assert(other);
const carrier=await(await check(await request('/admin/catalogs/carriers','POST',admin,{code:randomUUID(),name:'Batch09 test carrier'}),201,'carrier')).json();
const category=await(await check(await request('/admin/catalogs/sim-categories','POST',admin,{code:randomUUID(),name:'Batch09 test category'}),201,'category')).json();
const orders=[];
for(let i=0;i<4;i++){const sim=await(await check(await request('/admin/sims','POST',admin,{phoneNumber:'000936000'+i,costPrice:'70',sellingPrice:'100',visibilityRequested:true,carrierId:carrier.id,categoryId:category.id}),201,'SIM '+i)).json();
 orders.push(await(await check(await request('/admin/internal-orders','POST',admin,{idempotencyKey:randomUUID(),simId:sim.id,customer:{fullName:'Khách UI Batch09 '+i,phone:'000940'+i}}),201,'order '+i)).json());}
const root=i=>'/admin/orders/'+orders[i].id;
await check(await request(root(0),'GET',staff),200,'STAFF direct detail');const projection=await(await request(root(0),'GET',staff)).json();assert(!JSON.stringify(projection).includes('costPrice'));assert.equal(projection.items[0].sellingPrice,'100');
await check(await request('/admin/orders/'+randomUUID(),'GET',admin),404,'detail missing');await check(await request(root(0)+'/claim','POST','',{}),401,'anonymous claim');
await check(await request(root(0)+'/claim','POST',staff,{assignedStaffId:other.id}),400,'forged assignment claim');await check(await request(root(0)+'/claim','POST',staff,{},'https://evil.example'),403,'claim Origin');
for(const i of [1,2,3]){await check(await request(root(i)+'/claim','POST',staff,{}),201,'claim '+i);for(const status of ['CONFIRMED','PROCESSING'])await check(await request(root(i)+'/status','PATCH',staff,{status}),200,status+' '+i);}
await check(await request('/admin/employees/'+staffId+'/commission-policy','PUT',admin,{ratePercent:'15.123456789012345678901234567891'}),200,'policy before completion');
await check(await request(root(1)+'/assign','POST',staff,{assignedStaffId:other.id}),403,'STAFF cannot assign');
await check(await request(root(1)+'/assign','POST',admin,{assignedStaffId:other.id,reason:'UI test transfer'}),201,'ADMIN transfer');
await check(await request(root(1)+'/status','PATCH',staff,{status:'COMPLETED'}),403,'old owner revoked');
await check(await request(root(1)+'/status','PATCH',admin,{status:'COMPLETED'}),200,'ADMIN completes transferred');
const transferred=await(await request(root(1),'GET',admin)).json();assert.equal(transferred.completion.beneficiaryState,'UNRESOLVED');assert.equal(transferred.completion.beneficiaryId,null);
await check(await request(root(2)+'/status','PATCH',admin,{status:'COMPLETED'}),200,'ADMIN completes on behalf');
const completed=await(await request(root(2),'GET',admin)).json();assert.equal(completed.completion.rateSnapshot,'15.123456789012345678901234567891');assert.equal(completed.completion.beneficiaryId,staffId);assert.equal(completed.completion.approvalStatus,'PENDING_APPROVAL');
await check(await request('/admin/employees/'+staffId+'/commission-policy','PUT',admin,{ratePercent:'40'}),200,'later policy');await check(await request(root(2)+'/status','PATCH',staff,{status:'COMPLETED'}),409,'repeat completion rejected');assert.deepEqual((await(await request(root(2),'GET',admin)).json()).completion,completed.completion);
await check(await request(root(2)+'/status','PATCH',staff,{status:'CANCELLED'}),409,'no cancel workflow');await check(await request(root(2)+'/approve','POST',admin,{}),404,'no approval API');await check(await request('/public/orders','POST','',{}),404,'no public checkout');
const page=await fetch(fixture.url+'/admin/orders/'+orders[2].id,{headers:{Cookie:staff}});assert.equal(page.status,200);const html=await page.text();assert(html.includes('Snapshot khi hoàn thành'));assert(!html.includes('Giá vốn snapshot'));assert(!html.includes('costPrice'));checks.push({name:'STAFF SSR direct detail no cost',status:200});
await writeFile(new URL('../.local/batch09-ui-results.json',import.meta.url),JSON.stringify({createdAt:new Date().toISOString(),checks,orders,staffId,otherId:other.id}),{mode:0o600});
console.info('Batch09 Next proxy/SSR assertions PASS: '+checks.length);
