import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { HttpFixture } from './helpers/http-fixture';
import { orderData } from './helpers/order-data';
import { ReservationsService } from '../src/orders/reservations.service';
const f = new HttpFixture();
const service = () => f.app.get(ReservationsService);
test('P33 two concurrent orders reserve one SIM once; database unique/FK constraints prevent ghost and orphan holds', async () => {
  const { sim, order } = await orderData(f.db, f.adminId);
  const other = await f.db.order.create({ data: { orderCode: randomUUID(), customerId: order.customerId, createdBy: f.adminId } });
  const results = await Promise.allSettled([order.id, other.id].map(id => f.db.$transaction(tx => service().reserve(tx, id, sim.id))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  const held = await f.db.inventoryReservation.findMany({ where: { simId: sim.id } }); assert.equal(held.length, 1);
  assert.equal((await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } })).stockStatus, 'RESERVED');
  assert.equal((await f.db.order.findUniqueOrThrow({ where: { id: held[0].orderId } })).status, 'PENDING');
  await assert.rejects(f.db.inventoryReservation.create({ data: { simId: sim.id, orderId: other.id, phoneNumberSnapshot: sim.phoneNumber } }));
  await assert.rejects(f.db.inventoryReservation.create({ data: { simId: randomUUID(), orderId: order.id, phoneNumberSnapshot: '00999991' } }));
  await assert.rejects(f.db.inventoryReservation.create({ data: { simId: sim.id, orderId: randomUUID(), phoneNumberSnapshot: '00999992' } }));
  await assert.rejects(f.db.order.delete({ where: { id: held[0].orderId } }));
});
test('P33 removed, hidden, price-error, reserved, sold or unknown SIM and non-draft order cannot be reserved', async () => {
  for (const changes of [{ deletedAt: new Date() }, { isVisible: false }, { hasPriceError: true }, { isVisible: false, sellingPrice: '60' }, { stockStatus: 'RESERVED' as const }, { stockStatus: 'SOLD' as const }]) {
    const { sim, order } = await orderData(f.db, f.adminId);
    await f.db.sim.update({ where: { id: sim.id }, data: changes });
    await assert.rejects(f.db.$transaction(tx => service().reserve(tx, order.id, sim.id)), /no longer available/);
    assert.equal(await f.db.inventoryReservation.count({ where: { simId: sim.id } }), 0);
  }
  const { sim, order } = await orderData(f.db, f.adminId);
  await assert.rejects(f.db.$transaction(tx => service().reserve(tx, randomUUID(), sim.id)), /Draft order not found/);
  await assert.rejects(f.db.$transaction(tx => service().reserve(tx, order.id, randomUUID())), /no longer available/);
  await assert.rejects(f.db.$transaction(tx => service().reserve(tx, 'invalid', sim.id)), /Invalid/);
  await f.db.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
  await assert.rejects(f.db.$transaction(tx => service().reserve(tx, order.id, sim.id)), /not a pending draft/);
});
test('P33 caller failure rolls back draft/customer, SIM stock/version and reservation together', async () => {
  const { sim } = await orderData(f.db, f.adminId);
  const counts = { customers: await f.db.customer.count(), orders: await f.db.order.count() };
  await assert.rejects(f.db.$transaction(async tx => {
    const customer = await tx.customer.create({ data: { fullName: 'Rollback test', phone: '001' } });
    const order = await tx.order.create({ data: { orderCode: randomUUID(), customerId: customer.id, createdBy: f.adminId } });
    await service().reserve(tx, order.id, sim.id);
    throw new Error('fixture failure after hold');
  }), /fixture failure/);
  assert.equal(await f.db.customer.count(), counts.customers); assert.equal(await f.db.order.count(), counts.orders);
  assert.equal(await f.db.inventoryReservation.count({ where: { simId: sim.id } }), 0);
  assert.deepEqual(await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } }), sim);
});
test('P33 ADMIN removal of reserved SIM retains draft/reservation and records removal without cancelling order', async () => {
  const { sim, order } = await orderData(f.db, f.adminId);
  const { reservation } = await f.db.$transaction(tx => service().reserve(tx, order.id, sim.id));
  const held = await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } });
  assert.equal((await f.write('/admin/sims/' + sim.id, { version: held.version }, 'DELETE')).status, 200);
  assert.deepEqual(await f.db.order.findUniqueOrThrow({ where: { id: order.id } }), order);
  assert.deepEqual(await f.db.inventoryReservation.findUniqueOrThrow({ where: { id: reservation.id } }), reservation);
  assert.equal(await f.db.simRemovalLog.count({ where: { simId: sim.id } }), 1);
  assert.equal(await f.db.auditLog.count({ where: { targetId: sim.id, action: 'SIM_REMOVED' } }), 1);
  const replacement = await f.db.sim.create({ data: { phoneNumber: sim.phoneNumber, carrierId: sim.carrierId, categoryId: sim.categoryId,
    costPrice: '70', sellingPrice: '100', isVisible: true, visibilityRequested: true } });
  const next = await f.db.order.create({ data: { orderCode: randomUUID(), customerId: order.customerId, createdBy: f.adminId } });
  await assert.rejects(f.db.$transaction(tx => service().reserve(tx, next.id, replacement.id)), /active reservation/);
  await assert.rejects(f.db.inventoryReservation.create({ data: { orderId: next.id, simId: replacement.id, phoneNumberSnapshot: sim.phoneNumber } }));
  assert.equal(await f.db.inventoryReservation.count({ where: { phoneNumberSnapshot: sim.phoneNumber, releasedAt: null } }), 1);
});
