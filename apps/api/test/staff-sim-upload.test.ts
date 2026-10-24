import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PERMISSIONS, type StaffSimUploadUnavailable } from '@sim-dashboard/shared';
import { HttpFixture } from './helpers/http-fixture';
const f = new HttpFixture();
const path = '/admin/staff-sim-submissions';
test('P31 placeholder contract returns 501 without persisting even forged price/approval input', async () => {
  const count = await f.db.sim.count();
  for (const cookie of [f.staffCookie, f.adminCookie]) {
    const response = await f.write(path, { phoneNumber: '0001', costPrice: '1', role: 'ADMIN', approved: true }, 'POST', cookie);
    assert.equal(response.status, 501); assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json() as StaffSimUploadUnavailable;
    assert.equal(data.status, 'NOT_IMPLEMENTED'); assert.equal(data.code, 'STAFF_SIM_UPLOAD_NOT_IMPLEMENTED');
    assert(data.pendingDecisions.includes('PRICE_AUTHORITY'));
  }
  assert.equal(await f.db.sim.count(), count);
});
test('P31 session, permission and Origin guards apply; STAFF has no price/create/import write path', async () => {
  assert.equal((await f.write(path, {}, 'POST', '')).status, 401);
  assert.equal((await f.write(path, {}, 'POST', f.staffCookie, 'http://evil.example.test')).status, 403);
  for (const [route, method] of [['/admin/sims', 'POST'], ['/admin/sims/' + randomUUID(), 'PATCH'], ['/admin/sim-imports/preview', 'POST']])
    assert.equal((await f.write(route, { costPrice: '1' }, method, f.staffCookie)).status, 403);
  await f.db.employeePermission.create({ data: { userId: f.staffId, permission: PERMISSIONS.SIMS_CREATE, enabled: false, updatedBy: f.adminId } });
  assert.equal((await f.write(path, {}, 'POST', f.staffCookie)).status, 403);
});
