import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { HttpFixture } from './helpers/http-fixture';
import { orderData } from './helpers/order-data';
const f = new HttpFixture();
test('P32 order schema preserves exact immutable snapshots and RESTRICT identities through ADMIN edits and removal', async () => {
  const { sim, customer, order } = await orderData(f.db, f.adminId);
  const item = await f.db.orderItem.create({ data: { orderId: order.id, simId: sim.id, phoneNumberSnapshot: sim.phoneNumber,
    sellingPriceSnapshot: sim.sellingPrice, costPriceSnapshot: sim.costPrice } });
  assert.equal((await f.write('/admin/sims/' + sim.id, { version: sim.version, sellingPrice: '200', costPrice: '150' }, 'PATCH')).status, 200);
  const current = await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } });
  assert.equal((await f.write('/admin/sims/' + sim.id, { version: current.version }, 'DELETE')).status, 200);
  assert.deepEqual(await f.db.orderItem.findUniqueOrThrow({ where: { id: item.id } }), item);
  assert.equal(item.costPriceSnapshot.toString(), '70.000000000000000000000000000001');
  assert.equal(item.sellingPriceSnapshot.toString(), '100.000000000000000000000000000001');
  assert.deepEqual(await f.db.order.findUniqueOrThrow({ where: { id: order.id } }), order);
  await assert.rejects(f.db.sim.delete({ where: { id: sim.id } }));
  await assert.rejects(f.db.customer.delete({ where: { id: customer.id } }));
  await assert.rejects(f.db.order.delete({ where: { id: order.id } }));
  await assert.rejects(f.db.orderItem.update({ where: { id: item.id }, data: { costPriceSnapshot: '1' } }));
  await assert.rejects(f.db.orderItem.delete({ where: { id: item.id } }));
  await assert.rejects(f.db.$executeRaw`TRUNCATE order_items`);
});
test('P32 database rejects absent/invalid references, snapshots, duplicate order codes/items and inconsistent completion', async () => {
  const { sim, order } = await orderData(f.db, f.adminId);
  const input = { orderId: order.id, simId: sim.id, phoneNumberSnapshot: sim.phoneNumber, costPriceSnapshot: '70', sellingPriceSnapshot: '100' };
  for (const fields of [{ orderId: randomUUID() }, { simId: randomUUID() }, { costPriceSnapshot: '-1' }, { sellingPriceSnapshot: 'NaN' }, { phoneNumberSnapshot: 'invalid' }])
    await assert.rejects(f.db.orderItem.create({ data: { ...input, ...fields } }));
  await assert.rejects(f.db.$executeRaw`INSERT INTO order_items(id,order_id,sim_id,phone_number_snapshot,cost_price_snapshot) VALUES(${randomUUID()}::uuid,${order.id}::uuid,${sim.id}::uuid,${sim.phoneNumber},70)`);
  await f.db.orderItem.create({ data: input }); await assert.rejects(f.db.orderItem.create({ data: input }));
  await assert.rejects(f.db.order.create({ data: { orderCode: order.orderCode, customerId: order.customerId, createdBy: f.adminId } }));
  await assert.rejects(f.db.order.create({ data: { orderCode: randomUUID(), customerId: randomUUID(), createdBy: f.adminId } }));
  await assert.rejects(f.db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } }));
  await assert.rejects(f.db.order.update({ where: { id: order.id }, data: { completedAt: new Date(), completedBy: f.adminId } }));
  await assert.rejects(f.db.customer.create({ data: { fullName: ' ', phone: '0001' } }));
  await assert.rejects(f.db.customer.create({ data: { fullName: 'Test', phone: 'invalid' } }));
  const completed = await f.db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED', completedAt: new Date(), completedBy: f.staffId } });
  assert.equal(completed.status, 'COMPLETED'); assert.equal(completed.assignedStaffId, null);
});
