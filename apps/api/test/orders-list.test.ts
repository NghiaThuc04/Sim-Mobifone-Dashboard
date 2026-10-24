import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSIONS, type OrderList } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
import { orderData } from './helpers/order-data';
const f = new HttpFixture();
const path = '/admin/orders';
async function sample() {
  const fixture = await orderData(f.db, f.adminId);
  await f.db.orderItem.create({ data: { orderId: fixture.order.id, simId: fixture.sim.id, phoneNumberSnapshot: fixture.sim.phoneNumber,
    sellingPriceSnapshot: fixture.sim.sellingPrice, costPriceSnapshot: fixture.sim.costPrice } });
  return fixture;
}
test('P35 filters status/code/SIM/date/staff, stable paging and out-of-range empty response', async () => {
  const a = await sample(); const b = await sample();
  await f.db.order.update({ where: { id: a.order.id }, data: { status: 'PROCESSING', assignedStaffId: f.otherId, claimedAt: new Date() } });
  const query = new URLSearchParams({ status: 'PROCESSING', orderCode: a.order.orderCode, phoneNumber: a.sim.phoneNumber,
    assignedStaffId: f.otherId, fromDate: a.order.createdAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }), toDate: a.order.createdAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) });
  const response = await f.get(path + '?' + query); assert.equal(response.status, 200);
  const result = await response.json() as OrderList; assert.equal(result.total, 1); assert.equal(result.items[0].id, a.order.id);
  assert.equal(result.items[0].isLocked, true); assert.equal(result.items[0].assignedStaff?.id, f.otherId);
  assert.equal((await (await f.get(path + '?orderCode=' + b.order.orderCode)).json() as OrderList).items[0].isLocked, false);
  const first = await (await f.get(path + '?pageSize=1')).json() as OrderList;
  const second = await (await f.get(path + '?pageSize=1&page=2')).json() as OrderList; assert.notEqual(first.items[0].id, second.items[0].id);
  const outside = await (await f.get(path + '?page=9999')).json() as OrderList; assert.equal(outside.items.length, 0); assert.equal(outside.total, first.total);
  assert.equal((await (await f.get(path + '?orderCode=%25')).json() as OrderList).total, 0);
});
test('P35 STAFF sees other assignees read-only and no cost, customer phone, internal key or account security fields', async () => {
  const { order, sim } = await sample();
  await f.db.order.update({ where: { id: order.id }, data: { assignedStaffId: f.otherId, claimedAt: new Date() } });
  const admin = await (await f.get(path + '?orderCode=' + order.orderCode)).json() as OrderList;
  assert.equal(admin.items[0].firstItem?.costPrice, sim.costPrice.toString());
  const response = await f.get(path + '?orderCode=' + order.orderCode, f.staffCookie); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const staff = await response.json() as OrderList; assert.equal(staff.items[0].assignedStaff?.id, f.otherId); assert.equal(staff.canViewCost, false);
  assert.equal(staff.items[0].firstItem?.costPrice, undefined);
  for (const forbidden of ['costPrice', 'cost_price', 'password', 'idempotency', 'requestHash', '+8400001']) assert(!JSON.stringify(staff).includes(forbidden));
  for (const endpoint of [`${path}/${order.id}/claim`, `${path}/${order.id}`])
    assert.equal((await f.write(endpoint, { status: 'COMPLETED' }, 'PATCH', f.staffCookie)).status, 404);
  assert.equal((await f.write(path, {}, 'POST', f.staffCookie)).status, 404);
  await f.db.employeePermission.create({ data: { userId: f.staffId, permission: PERMISSIONS.ORDERS_VIEW, enabled: false, updatedBy: f.adminId } });
  assert.equal((await f.get(path, f.staffCookie)).status, 403); assert.equal((await f.get(path, '')).status, 401);
});
test('P35 Vietnam month/date boundaries and SIM snapshot survive current-phone change/removal', async () => {
  const { sim, order } = await sample();
  await f.db.order.update({ where: { id: order.id }, data: { createdAt: new Date('2025-12-31T17:00:00.000Z') } });
  await f.db.sim.update({ where: { id: sim.id }, data: { phoneNumber: sim.phoneNumber + '1', deletedAt: new Date() } });
  const jan = await (await f.get(path + '?month=2026-01&phoneNumber=' + sim.phoneNumber)).json() as OrderList;
  assert.equal(jan.total, 1); assert.equal(jan.items[0].firstItem?.phoneNumber, sim.phoneNumber);
  assert.equal((await (await f.get(path + '?fromDate=2026-01-01&toDate=2026-01-01&orderCode=' + order.orderCode)).json() as OrderList).total, 1);
  await f.db.order.update({ where: { id: order.id }, data: { createdAt: new Date('2026-01-31T17:00:00.000Z') } });
  assert.equal((await (await f.get(path + '?month=2026-01&orderCode=' + order.orderCode)).json() as OrderList).total, 0);
});
test('P35 rejects malformed/duplicate/unknown filters, while bounding multi-item list previews explicitly', async () => {
  for (const query of ['status=bad', 'page=0', 'pageSize=101', 'phoneNumber=%25', 'assignedStaffId=bad', 'month=2026-13',
    'fromDate=2026-02-30&toDate=2026-03-01', 'fromDate=2026-01-01', 'fromDate=2026-02-01&toDate=2026-01-01', 'page=1&page=2', 'includeCost=true'])
    assert.equal((await f.get(path + '?' + query)).status, 400);
  const a = await sample(); const b = await sample();
  await f.db.orderItem.create({ data: { orderId: a.order.id, simId: b.sim.id, phoneNumberSnapshot: b.sim.phoneNumber,
    costPriceSnapshot: b.sim.costPrice, sellingPriceSnapshot: b.sim.sellingPrice } });
  const result = await (await f.get(path + '?orderCode=' + a.order.orderCode)).json() as OrderList;
  assert.equal(result.items[0].itemCount, 2); assert(result.items[0].firstItem); assert.equal(result.items.length, 1);
});
