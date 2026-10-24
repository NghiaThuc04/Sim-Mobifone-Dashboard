import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';
import { PERMISSIONS, STAFF_PERMISSIONS } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
import { orderData } from './helpers/order-data';

const f = new HttpFixture();

async function processing() {
  const fixture = await orderData(f.db, f.adminId);
  const { order, sim } = fixture;
  await f.db.orderItem.create({ data: { orderId: order.id, simId: sim.id, phoneNumberSnapshot: sim.phoneNumber,
    sellingPriceSnapshot: sim.sellingPrice, costPriceSnapshot: sim.costPrice } });
  const root = '/admin/orders/' + order.id;
  assert.equal((await f.write(root + '/claim', {}, 'POST', f.staffCookie)).status, 201);
  for (const status of ['CONFIRMED', 'PROCESSING']) {
    assert.equal((await f.write(root + '/status', { status }, 'PATCH', f.staffCookie)).status, 200);
  }
  return { ...fixture, root };
}

async function withOrderLock(id: string, run: (lock: Client) => Promise<void>) {
  const lock = new Client({ connectionString: f.config.DATABASE_URL });
  await lock.connect();
  try {
    await lock.query('BEGIN');
    await lock.query('SELECT id FROM orders WHERE id = $1 FOR UPDATE', [id]);
    await run(lock);
  } finally {
    await lock.query('ROLLBACK');
    await lock.end();
  }
}

// Observe real PostgreSQL waiters so revocation happens after HTTP authentication,
// while the request is suspended before reading its mutation authority.
async function waitForOrderRequests(lock: Client, count: number) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await lock.query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'
        AND query LIKE '%FROM orders%FOR UPDATE%'`);
    if (result.rows[0].count >= count) return;
    await delay(10);
  }
  assert.fail('Expected authenticated order requests to wait on the fixture row lock.');
}

test('Astra: logout while claim waits on order lock rejects the stale session without assignment', async () => {
  const { order } = await orderData(f.db, f.adminId);
  await withOrderLock(order.id, async lock => {
    const pending = f.write('/admin/orders/' + order.id + '/claim', {}, 'POST', f.staffCookie);
    await waitForOrderRequests(lock, 1);
    assert.equal((await f.write('/auth/logout', {}, 'POST', f.staffCookie)).status, 204);
    await lock.query('COMMIT');
    assert.equal((await pending).status, 401);
  });
  assert.equal((await f.db.order.findUniqueOrThrow({ where: { id: order.id } })).assignedStaffId, null);
  assert.equal(await f.db.orderAssignmentHistory.count({ where: { orderId: order.id } }), 0);
});

test('Astra: permission revocation while owner status request waits is effective before mutation', async () => {
  const { order, root } = await processing();
  await withOrderLock(order.id, async lock => {
    const pending = f.write(root + '/status', { status: 'COMPLETED' }, 'PATCH', f.staffCookie);
    await waitForOrderRequests(lock, 1);
    const permissions = STAFF_PERMISSIONS.map(permission => ({ permission, enabled: permission !== PERMISSIONS.ORDERS_UPDATE_OWN }));
    assert.equal((await f.write('/admin/employees/' + f.staffId + '/permissions', { permissions }, 'PUT')).status, 200);
    await lock.query('COMMIT');
    assert.equal((await pending).status, 403);
  });
  assert.equal((await f.db.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'PROCESSING');
  assert.equal(await f.db.orderCompletion.count({ where: { orderId: order.id } }), 0);
  assert.equal(await f.db.orderStatusHistory.count({ where: { orderId: order.id } }), 2);
});

test('Astra: account lock while completion waits rejects stale identity and creates no snapshot', async () => {
  const { order, root } = await processing();
  await withOrderLock(order.id, async lock => {
    const pending = f.write(root + '/status', { status: 'COMPLETED' }, 'PATCH', f.staffCookie);
    await waitForOrderRequests(lock, 1);
    assert.equal((await f.write('/admin/employees/' + f.staffId + '/status', { status: 'locked' }, 'PATCH')).status, 200);
    await lock.query('COMMIT');
    assert.equal((await pending).status, 401);
  });
  assert.equal(await f.db.orderCompletion.count({ where: { orderId: order.id } }), 0);
  assert.equal(await f.db.auditLog.count({ where: { targetId: order.id, action: 'ORDER_COMPLETED' } }), 0);
});

test('Astra: queued ADMIN transfer commits before old-owner completion; new owner completes without beneficiary allocation', async () => {
  const { order, root } = await processing();
  for (const [id, ratePercent] of [[f.staffId, '11'], [f.otherId, '23']]) {
    assert.equal((await f.write('/admin/employees/' + id + '/commission-policy', { ratePercent }, 'PUT')).status, 200);
  }
  await withOrderLock(order.id, async lock => {
    const assignment = f.write(root + '/assign', { assignedStaffId: f.otherId });
    await waitForOrderRequests(lock, 1);
    const oldOwner = f.write(root + '/status', { status: 'COMPLETED' }, 'PATCH', f.staffCookie);
    await waitForOrderRequests(lock, 2);
    await lock.query('COMMIT');
    assert.equal((await assignment).status, 201);
    assert.equal((await oldOwner).status, 403);
  });
  assert.equal(await f.db.orderCompletion.count({ where: { orderId: order.id } }), 0);
  assert.equal((await f.write(root + '/status', { status: 'COMPLETED', beneficiaryId: f.otherId }, 'PATCH', f.otherCookie)).status, 409);
  assert.equal((await f.write(root + '/status', { status: 'COMPLETED' }, 'PATCH', f.otherCookie)).status, 200);
  const snapshot = await f.db.orderCompletion.findUniqueOrThrow({ where: { orderId: order.id } });
  assert.equal(snapshot.rateEmployeeId, f.otherId);
  assert.equal(snapshot.rateSnapshot?.toString(), '23');
  assert.equal(snapshot.beneficiaryId, null);
  assert.equal(snapshot.beneficiaryState, 'UNRESOLVED');
  assert.equal(snapshot.approvalStatus, 'PENDING_APPROVAL');
});

test('Astra: queued assignment rechecks ADMIN role instead of trusting authenticated principal', async () => {
  const { order } = await orderData(f.db, f.adminId);
  await withOrderLock(order.id, async lock => {
    const pending = f.write('/admin/orders/' + order.id + '/assign', { assignedStaffId: f.otherId });
    await waitForOrderRequests(lock, 1);
    // Role management has no public endpoint; the isolated fixture changes trusted state.
    await f.db.user.update({ where: { id: f.adminId }, data: { role: 'STAFF' } });
    await lock.query('COMMIT');
    assert.equal((await pending).status, 403);
  });
  assert.equal((await f.db.order.findUniqueOrThrow({ where: { id: order.id } })).assignedStaffId, null);
  assert.equal(await f.db.orderAssignmentHistory.count({ where: { orderId: order.id } }), 0);
});

test('Astra: completion queued before policy change snapshots the rate effective after acquiring order lock', async () => {
  const { order, root } = await processing();
  assert.equal((await f.write('/admin/employees/' + f.staffId + '/commission-policy', { ratePercent: '5' }, 'PUT')).status, 200);
  await withOrderLock(order.id, async lock => {
    const pending = f.write(root + '/status', { status: 'COMPLETED' }, 'PATCH', f.staffCookie);
    await waitForOrderRequests(lock, 1);
    assert.equal((await f.write('/admin/employees/' + f.staffId + '/commission-policy', { ratePercent: '17' }, 'PUT')).status, 200);
    await lock.query('COMMIT');
    assert.equal((await pending).status, 200);
  });
  const snapshot = await f.db.orderCompletion.findUniqueOrThrow({ where: { orderId: order.id } });
  assert.equal(snapshot.rateSnapshot?.toString(), '17');
  assert(snapshot.policyEffectiveAt && snapshot.policyEffectiveAt <= snapshot.completedAt);
  assert.equal((await f.write('/admin/employees/' + f.staffId + '/commission-policy', { ratePercent: '31' }, 'PUT')).status, 200);
  assert.equal((await f.write(root + '/status', { status: 'COMPLETED' }, 'PATCH', f.staffCookie)).status, 409);
  assert.deepEqual(await f.db.orderCompletion.findUniqueOrThrow({ where: { orderId: order.id } }), snapshot);
});
