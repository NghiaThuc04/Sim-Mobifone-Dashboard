import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MyLeaveMonth, PERMISSIONS } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
const f = new HttpFixture();
test('P18 session determines leave owner, month totals are confirmed and DTO omits administration fields', async () => {
  for (const [employee, days] of [[f.staffId,'1.5'],[f.otherId,'2']] as const) {
    assert.equal((await f.write(`/admin/employees/${employee}/leaves`, { fromDate:'2026-12-31',toDate:'2027-01-02',days,
      reason:'Self test',notes: employee === f.staffId ? 'My visible note' : 'Other private note',
      allocations:[{month:'2026-12',days: employee === f.staffId ? '0.5' : '1'},{month:'2027-01',days:'1'}] })).status,201);
  }
  const response = await f.get('/me/leaves?month=2026-12',f.staffCookie); assert.equal(response.status,200);
  const data = await response.json() as MyLeaveMonth;
  assert.equal(data.totalDays,'0.5'); assert.equal(data.items[0].notes,'My visible note');
  for (const key of ['employeeId','createdBy','salary','password','Other private note']) assert(!JSON.stringify(data).includes(key));
  assert.equal((await (await f.get('/me/leaves?month=2027-01',f.staffCookie)).json() as MyLeaveMonth).totalDays,'1');
  assert.equal((await (await f.get('/me/leaves?month=2027-02',f.staffCookie)).json() as MyLeaveMonth).totalDays,'0');
});
test('P18 rejects cross-user parameters, admin route, mutations, anonymous and revoked permission', async () => {
  for (const query of [`?employeeId=${f.otherId}`,`?user_id=${f.otherId}`,'?month=wrong']) assert.equal((await f.get('/me/leaves'+query,f.staffCookie)).status,400);
  assert.equal((await f.get(`/admin/employees/${f.otherId}/leaves`,f.staffCookie)).status,403);
  for (const method of ['POST','PATCH','DELETE']) assert.equal((await f.write('/me/leaves',{},method,f.staffCookie)).status,404);
  assert.equal((await f.get('/me/leaves','')).status,401);
  await f.db.employeePermission.create({ data:{userId:f.staffId,permission:PERMISSIONS.LEAVES_VIEW_SELF,enabled:false,updatedBy:f.adminId} });
  assert.equal((await f.get('/me/leaves',f.staffCookie)).status,403);
});
