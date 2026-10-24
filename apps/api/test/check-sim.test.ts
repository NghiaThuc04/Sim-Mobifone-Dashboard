import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomInt } from 'node:crypto';
import { PERMISSIONS, SIM_STOCK_STATUSES, type SimCheckResult } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
const f = new HttpFixture();
const path = '/admin/check-sim?phoneNumber=';
async function sample() {
  const carrier = await f.db.carrier.create({ data: { code: randomUUID(), name: 'Test lookup carrier' } });
  const category = await f.db.simCategory.create({ data: { code: randomUUID(), name: 'Test lookup category' } });
  return f.db.sim.create({ data: { phoneNumber: '00' + randomInt(0, 1000000000), carrierId: carrier.id, categoryId: category.id, costPrice: '70', sellingPrice: '100' } });
}
test('P27 exact active lookup, ADMIN prices and explicit unknown order/confirmation facts', async () => {
  const sim = await sample();
  for (const stockStatus of SIM_STOCK_STATUSES) {
    await f.db.sim.update({ where: { id: sim.id }, data: { stockStatus } });
    const response = await f.get(path + sim.phoneNumber); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json() as SimCheckResult;
    assert.equal(data.item?.stockStatus, stockStatus); assert.equal(data.item.costPrice, '70'); assert.equal(data.item.orderSource, 'NOT_IMPLEMENTED');
    assert.deepEqual(data.item.errorConfirmation, { verification: 'UNVERIFIED', recordedAt: null }); assert.equal(data.item.removal.allowed, true);
  }
  assert.equal((await (await f.get(path + sim.phoneNumber.slice(1))).json() as SimCheckResult).item, null);
  await f.db.sim.update({ where: { id: sim.id }, data: { deletedAt: new Date() } });
  assert.deepEqual(await (await f.get(path + sim.phoneNumber)).json(), { match: 'ACTIVE_ONLY', item: null });
});
test('P27 STAFF DTO minimizes data and never trusts SOLD, price errors or legacy confirmation timestamps', async () => {
  const sim = await sample();
  await f.db.sim.update({ where: { id: sim.id }, data: { stockStatus: 'SOLD', hasPriceError: true, errorConfirmedAt: new Date() } });
  let data = await (await f.get(path + sim.phoneNumber, f.staffCookie)).json() as SimCheckResult;
  assert(data.item); assert.equal(data.item.costPrice, undefined); assert.equal(data.item.grossProfit, '30'); assert.equal(data.item.removal.allowed, false); assert.equal(data.item.errorConfirmation.verification, 'UNVERIFIED');
  assert(!JSON.stringify(data).includes('password')); assert(!JSON.stringify(data).includes('customer')); assert(!JSON.stringify(data).includes('Snapshot'));
  await f.db.employeePermission.create({ data: { userId: f.staffId, permission: PERMISSIONS.PROFITS_VIEW, enabled: false, updatedBy: f.adminId } });
  data = await (await f.get(path + sim.phoneNumber, f.staffCookie)).json() as SimCheckResult; assert.equal(data.item?.grossProfit, undefined);
  await f.db.employeePermission.create({ data: { userId: f.staffId, permission: PERMISSIONS.SIMS_DELETE_ELIGIBLE, enabled: false, updatedBy: f.adminId } });
  data = await (await f.get(path + sim.phoneNumber, f.staffCookie)).json() as SimCheckResult; assert.equal(data.item?.removal.reason, 'PERMISSION_DENIED');
});
test('P27 denies anonymous/revoked access and malformed, duplicate or wildcard lookup parameters', async () => {
  const sim = await sample(); assert.equal((await f.get(path + sim.phoneNumber, '')).status, 401);
  for (const query of ['', '?phoneNumber=%25', '?phoneNumber=123&phoneNumber=456', '?phoneNumber=123&role=ADMIN', '?phoneNumber=123&includeCost=true']) assert.equal((await f.get('/admin/check-sim' + query)).status, 400);
  await f.db.employeePermission.create({ data: { userId: f.staffId, permission: PERMISSIONS.CHECK_SIM_VIEW, enabled: false, updatedBy: f.adminId } });
  assert.equal((await f.get(path + sim.phoneNumber, f.staffCookie)).status, 403);
  assert.equal((await f.write('/admin/check-sim', {})).status, 404);
});
