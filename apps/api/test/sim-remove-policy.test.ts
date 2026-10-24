import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { PERMISSIONS, STAFF_PERMISSIONS, type Account, type SimCheckResult, type SimListItem } from '@sim-dashboard/shared';
import { ForbiddenException } from '@nestjs/common';
import { HttpFixture } from './helpers/http-fixture';
import { InventoryService } from '../src/inventory/inventory.service';
const f = new HttpFixture();
async function sample(stockStatus: 'AVAILABLE' | 'RESERVED' | 'SOLD', priceError: boolean) {
  const carrier = await f.db.carrier.create({ data: { code: randomUUID(), name: 'Staff removal policy test' } });
  const category = await f.db.simCategory.create({ data: { code: randomUUID(), name: 'Staff removal policy test' } });
  const response = await f.write('/admin/sims', { phoneNumber: '00' + randomInt(0, 1000000000), carrierId: carrier.id, categoryId: category.id,
    stockStatus, costPrice: '70', sellingPrice: priceError ? '60' : '100', visibilityRequested: true });
  assert.equal(response.status, 201); return await response.json() as SimListItem;
}
test('P30 STAFF cannot delete any stock state using automatic price alerts, legacy timestamp, another actor or client claims', async () => {
  for (const status of ['AVAILABLE', 'RESERVED', 'SOLD'] as const) for (const priceError of [false, true]) {
    const sim = await sample(status, priceError);
    await f.db.sim.update({ where: { id: sim.id }, data: { errorConfirmedAt: new Date() } });
    const before = await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } });
    const inspection = await (await f.get('/admin/check-sim?phoneNumber=' + sim.phoneNumber, f.staffCookie)).json() as SimCheckResult;
    assert.deepEqual(inspection.item?.removal, { allowed: false, reason: 'VERIFIED_SOURCE_MISSING' });
    assert.equal(inspection.item?.errorConfirmation.verification, 'UNVERIFIED');
    assert.equal(inspection.item?.costPrice, undefined);
    for (const cookie of [f.staffCookie, f.otherCookie]) for (const claims of [{}, { eligible: true }, { confirmed: true, confirmedBy: f.adminId },
      { role: 'ADMIN', actorId: f.adminId }, { orderStatus: 'COMPLETED', completedAt: new Date().toISOString() }]) {
      const response = await f.write('/admin/sims/' + sim.id, { version: sim.version, ...claims }, 'DELETE', cookie);
      assert.equal(response.status, 403); assert(!JSON.stringify(await response.json()).includes('costPrice'));
    }
    const spoofed = await fetch(f.origin + '/api/v1/admin/sims/' + sim.id, { method: 'DELETE', headers: {
      Cookie: f.staffCookie, Origin: f.config.FRONTEND_ORIGIN, 'Content-Type': 'application/json', 'X-Role': 'ADMIN', 'X-User-Id': f.adminId,
    }, body: JSON.stringify({ version: sim.version }) });
    assert.equal(spoofed.status, 403);
    assert.deepEqual(await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } }), before);
    assert.equal(await f.db.simRemovalLog.count({ where: { simId: sim.id } }), 0);
    assert.equal(await f.db.auditLog.count({ where: { action: 'SIM_REMOVED', targetId: sim.id } }), 0);
  }
});
test('P30 revoked deletion permission and injected administrative override never grant removal; ADMIN remains independent', async () => {
  const sim = await sample('SOLD', true);
  await assert.rejects(f.db.employeePermission.create({ data: {
    userId: f.staffId, permission: PERMISSIONS.SETTINGS_ADMIN, enabled: true, updatedBy: f.adminId,
  } }));
  await f.db.employeePermission.create({ data: {
    userId: f.staffId, permission: PERMISSIONS.SIMS_DELETE_ELIGIBLE, enabled: false, updatedBy: f.adminId,
  } });
  const check = await (await f.get('/admin/check-sim?phoneNumber=' + sim.phoneNumber, f.staffCookie)).json() as SimCheckResult;
  assert.deepEqual(check.item?.removal, { allowed: false, reason: 'PERMISSION_DENIED' });
  assert.equal((await f.write('/admin/sims/' + sim.id, { version: sim.version }, 'DELETE', f.staffCookie)).status, 403);
  assert.equal((await f.write('/admin/sims/' + randomUUID(), { version: 1 }, 'DELETE', f.staffCookie)).status, 403);
  const actor: Account = { id: f.staffId, email: 'staff@fixture.example.test', fullName: 'Fixture', role: 'STAFF', permissions: [...STAFF_PERMISSIONS] };
  assert.throws(() => f.app.get(InventoryService).remove(sim.id, { version: sim.version, eligible: true }, actor), ForbiddenException);
  assert.equal((await f.write('/admin/sims/' + sim.id, { version: sim.version }, 'DELETE')).status, 200);
  assert.equal(await f.db.simRemovalLog.count({ where: { simId: sim.id } }), 1);
});
