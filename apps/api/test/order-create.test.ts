import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { InternalOrderCreateResult } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
import { orderData } from './helpers/order-data';
import { readConfig } from '../src/config';
import { createApp } from '../src/create-app';
const f = new HttpFixture(readConfig({ ...process.env, INTERNAL_ORDER_CREATION_ENABLED: 'true' }));
const path = '/admin/internal-orders';
const input = (simId: string) => ({ idempotencyKey: randomUUID(), simId, customer: { fullName: 'Khách API kiểm thử', phone: '+840001' } });
async function counts() {
  return { customers: await f.db.customer.count(), orders: await f.db.order.count(), items: await f.db.orderItem.count(),
    holds: await f.db.inventoryReservation.count(), keys: await f.db.orderCreateKey.count() };
}
test('P34 creates one pending order, immutable DB price snapshots and hold; replay remains original after edit/removal', async () => {
  const { sim } = await orderData(f.db, f.adminId); const body = input(sim.id);
  const response = await f.write(path, body); assert.equal(response.status, 201); assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json() as InternalOrderCreateResult;
  assert.deepEqual(Object.keys(result).sort(), ['id', 'orderCode', 'status']); assert.equal(result.status, 'PENDING');
  const item = await f.db.orderItem.findFirstOrThrow({ where: { orderId: result.id } });
  assert.equal(item.costPriceSnapshot.toString(), sim.costPrice.toString()); assert.equal(item.sellingPriceSnapshot.toString(), sim.sellingPrice.toString());
  assert.equal(item.phoneNumberSnapshot, sim.phoneNumber);
  assert.equal((await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } })).stockStatus, 'RESERVED');
  const current = await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } });
  assert.equal((await f.write('/admin/sims/' + sim.id, { version: current.version, costPrice: '150', sellingPrice: '200' }, 'PATCH')).status, 200);
  const changed = await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } });
  assert.equal((await f.write('/admin/sims/' + sim.id, { version: changed.version }, 'DELETE')).status, 200);
  const before = await counts();
  assert.deepEqual(await (await f.write(path, body)).json(), result); assert.deepEqual(await counts(), before);
  assert.deepEqual(await f.db.orderItem.findUniqueOrThrow({ where: { id: item.id } }), item);
  assert.equal(await f.db.auditLog.count({ where: { targetId: result.id, action: 'ORDER_CREATED' } }), 1);
  const record = await f.db.orderCreateKey.findUniqueOrThrow({ where: { actorId_idempotencyKey: { actorId: f.adminId, idempotencyKey: body.idempotencyKey } } });
  await assert.rejects(f.db.orderCreateKey.delete({ where: { actorId_idempotencyKey: { actorId: record.actorId, idempotencyKey: record.idempotencyKey } } }));
});
test('P34 concurrent identical keys create once; changed payload conflicts and different keys cannot double-reserve', async () => {
  const { sim } = await orderData(f.db, f.adminId); const body = input(sim.id); const before = await counts();
  const results = await Promise.all([f.write(path, body), f.write(path, { ...body, idempotencyKey: body.idempotencyKey.toUpperCase(), simId: body.simId.toUpperCase() })]); assert(results.every(r => r.status === 201));
  assert.deepEqual(await results[0].json(), await results[1].json());
  assert.equal((await f.write(path, { ...body, customer: { ...body.customer, fullName: 'Khác' } })).status, 409);
  assert.deepEqual(await counts(), Object.fromEntries(Object.entries(before).map(([key, value]) => [key, value + 1])));
  const { sim: second } = await orderData(f.db, f.adminId); const current = await counts();
  const contested = await Promise.all([f.write(path, input(second.id)), f.write(path, input(second.id))]);
  assert.deepEqual(contested.map(r => r.status).sort(), [201, 409]);
  assert.deepEqual(await counts(), Object.fromEntries(Object.entries(current).map(([key, value]) => [key, value + 1])));
});
test('P34 idempotency is scoped to authenticated actor, never body role or actor claims', async () => {
  const first = await orderData(f.db, f.adminId); const second = await orderData(f.db, f.adminId); const body = input(first.sim.id);
  assert.equal((await f.write(path, body)).status, 201);
  assert.equal((await f.write(path, body, 'POST', f.otherCookie)).status, 403);
  await f.db.user.update({ where: { id: f.otherId }, data: { role: 'ADMIN' } });
  assert.equal((await f.write(path, { ...body, simId: second.sim.id }, 'POST', f.otherCookie)).status, 201);
  assert.equal(await f.db.orderCreateKey.count({ where: { idempotencyKey: body.idempotencyKey } }), 2);
});
test('P34 rejects unavailable SIM and strict malformed/customer/price/status inputs without writes', async () => {
  const { sim } = await orderData(f.db, f.adminId); const body = input(sim.id); const before = await counts();
  for (const invalid of [{}, { ...body, idempotencyKey: 'bad' }, { ...body, simId: 'bad' }, { ...body, sellingPrice: '1' },
    { ...body, status: 'COMPLETED' }, { ...body, actorId: f.adminId }, { ...body, customer: { fullName: ' ', phone: '001' } },
    { ...body, customer: { fullName: 'Test\u0000', phone: '001' } }, { ...body, customer: { fullName: 'Test', phone: 'bad' } }])
    assert.equal((await f.write(path, invalid)).status, 400);
  assert.equal((await f.write(path, body, 'POST', '')).status, 401);
  assert.equal((await f.write(path, body, 'POST', f.staffCookie)).status, 403);
  assert.equal((await f.write(path, body, 'POST', f.adminCookie, 'http://evil.example.test')).status, 403);
  assert.equal((await f.write(path, input(randomUUID()))).status, 409);
  await f.db.sim.update({ where: { id: sim.id }, data: { isVisible: false } });
  assert.equal((await f.write(path, body)).status, 409);
  assert.deepEqual(await counts(), before);
});
test('P34 order-item or audit failure rolls back all writes and allows the same key to retry', async () => {
  for (const table of ['order_items', 'audit_logs'] as const) {
    const { sim } = await orderData(f.db, f.adminId); const body = input(sim.id); const before = await counts();
    await f.db.$executeRawUnsafe(`CREATE FUNCTION reject_order_test() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF TG_TABLE_NAME='order_items' THEN RAISE EXCEPTION 'fixture'; END IF; IF NEW.action='ORDER_CREATED' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END; $$`);
    await f.db.$executeRawUnsafe(`CREATE TRIGGER reject_order_test BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_order_test()`);
    try { assert.equal((await f.write(path, body)).status, 503); }
    finally { await f.db.$executeRawUnsafe(`DROP TRIGGER reject_order_test ON ${table}`); await f.db.$executeRaw`DROP FUNCTION reject_order_test()`; }
    assert.deepEqual(await counts(), before); assert.deepEqual(await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } }), sim);
    assert.equal((await f.write(path, body)).status, 201);
  }
});
test('P34 disabled by default, rejects invalid flag and cannot enable internal test creation in production', async () => {
  const config = readConfig({ ...process.env, INTERNAL_ORDER_CREATION_ENABLED: undefined }); assert.equal(config.INTERNAL_ORDER_CREATION_ENABLED, false);
  assert.throws(() => readConfig({ ...process.env, INTERNAL_ORDER_CREATION_ENABLED: 'yes' }));
  assert.throws(() => readConfig({ ...process.env, NODE_ENV: 'production', FRONTEND_ORIGIN: 'https://example.test', INTERNAL_ORDER_CREATION_ENABLED: 'true' }), /cannot be enabled in production/);
  const disabled = await createApp(false, config); await disabled.listen(0, '127.0.0.1');
  try {
    const response = await fetch((await disabled.getUrl()) + '/api/v1' + path, { method: 'POST', headers: {
      Cookie: f.adminCookie, Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json',
    }, body: JSON.stringify(input(randomUUID())) });
    assert.equal(response.status, 404);
  } finally { await disabled.close(); }
});
