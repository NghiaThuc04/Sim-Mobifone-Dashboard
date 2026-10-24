import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { type SimCheckResult, type SimListItem } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
const f = new HttpFixture();
async function sample() {
  const carrier = await f.db.carrier.create({ data: { code: randomUUID(), name: 'Policy test carrier' } });
  const category = await f.db.simCategory.create({ data: { code: randomUUID(), name: 'Policy test category' } });
  const response = await f.write('/admin/sims', { phoneNumber: '00' + randomInt(0, 1000000000), carrierId: carrier.id, categoryId: category.id, costPrice: '70', sellingPrice: '60' });
  assert.equal(response.status, 201); return await response.json() as SimListItem;
}
test('P28 no confirmation mutation route and no confirmation field can be injected through existing SIM PATCH', async () => {
  const sim = await sample();
  for (const cookie of [f.adminCookie, f.staffCookie]) {
    for (const endpoint of [`/admin/sims/${sim.id}/confirm-error`, `/admin/sims/${sim.id}/error-confirmation`, '/admin/sim-error-confirmations'])
      assert.equal((await f.write(endpoint, { simId: sim.id, confirmed: true }, 'POST', cookie)).status, 404);
    for (const fields of [{ errorConfirmedAt: new Date().toISOString() }, { hasPriceError: true }, { confirmed: true, confirmedBy: f.adminId }])
      assert.equal((await f.write('/admin/sims/' + sim.id, { version: sim.version, ...fields }, 'PATCH', cookie)).status, cookie === f.adminCookie ? 400 : 403);
  }
  const current = await f.db.sim.findUniqueOrThrow({ where: { id: sim.id } });
  assert.equal(current.errorConfirmedAt, null); assert.equal(current.hasPriceError, true);
});
test('P28 automatic price alert and legacy timestamp are never treated as verified confirmation', async () => {
  const sim = await sample(); assert.equal(await f.db.simPriceAlert.count({ where: { simId: sim.id } }), 1);
  await f.db.sim.update({ where: { id: sim.id }, data: { errorConfirmedAt: new Date() } });
  const result = await (await f.get('/admin/check-sim?phoneNumber=' + sim.phoneNumber, f.staffCookie)).json() as SimCheckResult;
  assert(result.item?.errorConfirmation.recordedAt); assert.equal(result.item.errorConfirmation.verification, 'UNVERIFIED');
  assert.deepEqual(result.item.removal, { allowed: false, reason: 'VERIFIED_SOURCE_MISSING' });
});
