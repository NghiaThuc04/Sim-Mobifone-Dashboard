import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomInt } from 'node:crypto';
import { PERMISSIONS, type PriceAlertList, type SimListItem } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
const f = new HttpFixture();
const path = '/admin/alerts/sim-pricing';
async function sample() {
  const carrier = await f.db.carrier.create({ data: { code: randomUUID(), name: 'Test alerts carrier' } });
  const category = await f.db.simCategory.create({ data: { code: randomUUID(), name: 'Test alerts category' } });
  const response = await f.write('/admin/sims', { phoneNumber: '00' + randomInt(0, 1000000000), carrierId: carrier.id, categoryId: category.id, costPrice: '70000.01', sellingPrice: '60000', visibilityRequested: true });
  assert.equal(response.status, 201); return await response.json() as SimListItem;
}
test('P26 empty, ADMIN snapshots, exact difference, open/resolved paging and archived alert history', async () => {
  assert.equal((await (await f.get(path)).json() as PriceAlertList).total, 0);
  const sim = await sample(); const second = await sample();
  const open = await (await f.get(path + '?pageSize=1')).json() as PriceAlertList;
  assert.equal(open.total, 2); assert.equal(open.openCount, 2); assert.equal(open.totalPages, 2);
  assert.equal(open.items[0].costPrice, '70000.01'); assert.equal(open.items[0].difference, '-10000.01');
  const next = await (await f.get(path + '?pageSize=1&page=2')).json() as PriceAlertList; assert.notEqual(next.items[0].id, open.items[0].id);
  assert.equal((await f.write('/admin/sims/' + sim.id, { version: sim.version, sellingPrice: '100000' }, 'PATCH')).status, 200);
  await f.db.sim.update({ where: { id: second.id }, data: { deletedAt: new Date() } });
  const resolved = await (await f.get(path + '?status=resolved')).json() as PriceAlertList;
  assert.equal(resolved.items[0].simId, sim.id); assert.equal(resolved.items[0].sellingPrice, '60000'); assert.equal(resolved.openCount, 1);
  const archived = await (await f.get(path)).json() as PriceAlertList; assert(archived.items[0].deletedAt);
  assert.equal((await (await f.get(path + '?status=all')).json() as PriceAlertList).total, 2);
});
test('P26 STAFF projection and current permissions; read-only API validates all query fields', async () => {
  await sample();
  const response = await f.get(path, f.staffCookie); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  let data = await response.json() as PriceAlertList; assert(!JSON.stringify(data).includes('cost')); assert(data.items[0].difference);
  await f.db.employeePermission.create({ data: { userId: f.staffId, permission: PERMISSIONS.PROFITS_VIEW, enabled: false, updatedBy: f.adminId } });
  data = await (await f.get(path, f.staffCookie)).json() as PriceAlertList; assert.equal(data.items[0].difference, undefined);
  await f.db.employeePermission.create({ data: { userId: f.staffId, permission: PERMISSIONS.CHECK_SIM_VIEW, enabled: false, updatedBy: f.adminId } });
  assert.equal((await f.get(path, f.staffCookie)).status, 403); assert.equal((await f.get(path, '')).status, 401);
  for (const query of ['status=invalid', 'page=0', 'pageSize=101', 'costPrice=1', 'status=open&status=resolved']) assert.equal((await f.get(path + '?' + query)).status, 400);
  assert.equal((await f.write(path, {})).status, 404);
});
