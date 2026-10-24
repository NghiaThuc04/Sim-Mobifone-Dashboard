import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import type { SimListItem, SimCheckResult, PriceAlertList } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
const f = new HttpFixture();
async function sample(stockStatus: 'AVAILABLE' | 'RESERVED' | 'SOLD' = 'AVAILABLE', priceError = false) {
  const carrier = await f.db.carrier.create({ data: { code: randomUUID(), name: 'Removal test carrier' } });
  const category = await f.db.simCategory.create({ data: { code: randomUUID(), name: 'Removal test category' } });
  const input = { phoneNumber: '00' + randomInt(0, 1000000000), carrierId: carrier.id, categoryId: category.id,
    stockStatus, costPrice: '70', sellingPrice: priceError ? '60' : '100', visibilityRequested: true };
  const response = await f.write('/admin/sims', input);
  assert.equal(response.status, 201);
  return { sim: await response.json() as SimListItem, input };
}
const path = (id: string) => '/admin/sims/' + id;
test('P29 ADMIN removes every stock status and price-error state, retaining snapshots, alerts and immutable removal log', async () => {
  for (const status of ['AVAILABLE', 'RESERVED', 'SOLD'] as const) for (const priceError of [false, true]) {
    const { sim } = await sample(status, priceError);
    const edit = await f.write(path(sim.id), { version: sim.version, sellingPrice: priceError ? '65' : '110' }, 'PATCH');
    assert.equal(edit.status, 200);
    const current = await edit.json() as SimListItem;
    const before = await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } });
    const changes = await f.db.simChange.findMany({ where: { simId: sim.id } });
    const alerts = await f.db.simPriceAlert.findMany({ where: { simId: sim.id } });
    const response = await f.write(path(sim.id), { version: current.version, reason: '  Bỏ khỏi kho thử nghiệm  ' }, 'DELETE');
    assert.equal(response.status, 200);
    const dto = await response.json(); assert.deepEqual(Object.keys(dto).sort(), ['deletedAt', 'id', 'version']);
    const archived = await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } });
    assert(archived.deletedAt); assert.equal(archived.deletedAt.toISOString(), dto.deletedAt);
    assert.equal(archived.isVisible, false); assert.equal(archived.visibilityRequested, false);
    assert.equal(archived.version, current.version + 1); assert.equal(archived.updatedBy, f.adminId);
    for (const key of ['phoneNumber', 'stockStatus', 'hasPriceError', 'errorConfirmedAt', 'createdBy'] as const) assert.deepEqual(archived[key], before[key]);
    assert.equal(archived.costPrice.toString(), before.costPrice.toString()); assert.equal(archived.sellingPrice.toString(), before.sellingPrice.toString());
    assert.deepEqual(await f.db.simChange.findMany({ where: { simId: sim.id } }), changes);
    assert.deepEqual(await f.db.simPriceAlert.findMany({ where: { simId: sim.id } }), alerts);
    const log = await f.db.simRemovalLog.findUniqueOrThrow({ where: { simId: sim.id } });
    assert.equal(log.phoneNumberSnapshot, sim.phoneNumber); assert.equal(log.actorId, f.adminId);
    assert.equal(log.reason, 'Bỏ khỏi kho thử nghiệm'); assert.equal(log.removedAt.toISOString(), dto.deletedAt);
    assert.equal((log.before as { stockStatus: string }).stockStatus, status);
    assert.equal((log.before as { costPrice: string }).costPrice, before.costPrice.toString());
    await assert.rejects(f.db.simRemovalLog.update({ where: { id: log.id }, data: { reason: 'rewrite' } }));
    await assert.rejects(f.db.simRemovalLog.delete({ where: { id: log.id } }));
    await assert.rejects(f.db.sim.delete({ where: { id: sim.id } }));
    const audit = await f.db.auditLog.findFirstOrThrow({ where: { targetId: sim.id, action: 'SIM_REMOVED' } });
    assert.equal(audit.actorId, f.adminId);
    assert.equal((audit.metadata as { removalId: string }).removalId, log.id);
    assert.equal((await (await f.get('/admin/check-sim?phoneNumber=' + sim.phoneNumber)).json() as SimCheckResult).item, null);
    if (priceError) {
      const list = await (await f.get('/admin/alerts/sim-pricing?status=all&pageSize=100')).json() as PriceAlertList;
      assert(list.items.some(row => row.simId === sim.id && row.deletedAt === dto.deletedAt));
    }
  }
  await assert.rejects(f.db.$executeRaw`TRUNCATE sim_removal_logs`);
});
test('P29 removal frees only active-phone uniqueness, preserves old SIM identity and rejects repeated removal consistently', async () => {
  const { sim, input } = await sample();
  assert.equal((await f.write(path(sim.id), { version: sim.version }, 'DELETE')).status, 200);
  assert.equal((await f.write(path(sim.id), { version: sim.version }, 'DELETE')).status, 404);
  const response = await f.write('/admin/sims', input); assert.equal(response.status, 201);
  const replacement = await response.json() as SimListItem; assert.notEqual(replacement.id, sim.id);
  assert.equal(await f.db.simRemovalLog.count({ where: { simId: sim.id } }), 1);
  assert.equal(await f.db.auditLog.count({ where: { targetId: sim.id, action: 'SIM_REMOVED' } }), 1);
  const check = await (await f.get('/admin/check-sim?phoneNumber=' + sim.phoneNumber)).json() as SimCheckResult;
  assert.equal(check.item?.id, replacement.id);
});
test('P29 direct DELETE enforces sessions, ADMIN, Origin, identifiers and strict version/reason input', async () => {
  const { sim } = await sample(); const body = { version: sim.version };
  assert.equal((await f.write(path(sim.id), body, 'DELETE', '')).status, 401);
  assert.equal((await f.write(path(sim.id), body, 'DELETE', f.staffCookie)).status, 403);
  assert.equal((await f.write(path(sim.id), body, 'DELETE', f.adminCookie, 'http://evil.example.test')).status, 403);
  assert.equal((await f.write(path('invalid'), body, 'DELETE')).status, 400);
  assert.equal((await f.write(path(randomUUID()), body, 'DELETE')).status, 404);
  for (const input of [{}, { version: 0 }, { version: '1' }, { version: 1.1 }, { version: 2147483648 },
    { ...body, reason: '' }, { ...body, reason: 'x'.repeat(501) }, { ...body, reason: '\u0000' }, { ...body, confirmed: true }])
    assert.equal((await f.write(path(sim.id), input, 'DELETE')).status, 400);
  assert.equal((await f.write(path(sim.id), { version: sim.version + 1 }, 'DELETE')).status, 409);
  assert.equal((await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } })).deletedAt, null);
  assert.equal(await f.db.simRemovalLog.count({ where: { simId: sim.id } }), 0);
});
test('P29 concurrent duplicate removals have one winner and one immutable audit/log', async () => {
  const { sim } = await sample();
  const responses = await Promise.all([1, 2].map(() => f.write(path(sim.id), { version: sim.version }, 'DELETE')));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 404]);
  assert.equal(await f.db.simRemovalLog.count({ where: { simId: sim.id } }), 1);
  assert.equal(await f.db.auditLog.count({ where: { targetId: sim.id, action: 'SIM_REMOVED' } }), 1);
});
test('P29 edit/remove race serializes on SIM row; a stale removal cannot remove changed data', async () => {
  const { sim } = await sample();
  const [edit, remove] = await Promise.all([
    f.write(path(sim.id), { version: sim.version, sellingPrice: '120' }, 'PATCH'),
    f.write(path(sim.id), { version: sim.version }, 'DELETE'),
  ]);
  assert([[200, 409], [404, 200]].some(([e, r]) => e === edit.status && r === remove.status));
  const current = await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } });
  if (edit.status === 200) {
    assert.equal(current.version, (await edit.json() as SimListItem).version);
    assert.equal(current.deletedAt, null); assert.equal(current.sellingPrice.toString(), '120');
  } else {
    assert.equal(current.version, sim.version + 1);
    assert(current.deletedAt); assert.equal(current.sellingPrice.toString(), '100');
  }
  assert.equal(await f.db.simRemovalLog.count({ where: { simId: sim.id } }), remove.status === 200 ? 1 : 0);
});
test('P29 failure inserting removal log or audit rolls back SIM removal atomically', async () => {
  for (const table of ['sim_removal_logs', 'audit_logs'] as const) {
    const { sim } = await sample('RESERVED', true);
    const before = await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } });
    await f.db.$executeRawUnsafe(`CREATE FUNCTION reject_removal_test() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF TG_TABLE_NAME='sim_removal_logs' OR NEW.action='SIM_REMOVED' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END; $$`);
    await f.db.$executeRawUnsafe(`CREATE TRIGGER reject_removal_test BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_removal_test()`);
    try { assert.equal((await f.write(path(sim.id), { version: sim.version }, 'DELETE')).status, 503); }
    finally {
      await f.db.$executeRawUnsafe(`DROP TRIGGER reject_removal_test ON ${table}`);
      await f.db.$executeRaw`DROP FUNCTION reject_removal_test()`;
    }
    assert.deepEqual(await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } }), before);
    assert.equal(await f.db.simRemovalLog.count({ where: { simId: sim.id } }), 0);
    assert.equal(await f.db.auditLog.count({ where: { targetId: sim.id, action: 'SIM_REMOVED' } }), 0);
  }
});
