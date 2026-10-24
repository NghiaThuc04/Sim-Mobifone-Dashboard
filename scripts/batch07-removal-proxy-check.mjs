import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { projectRoot } from './postgres.mjs';

const fixture = JSON.parse(await readFile(join(projectRoot, '.local/ui-current.json'), 'utf8'));
assert.equal(fixture.url, 'http://127.0.0.1:3110');
const checks = [];
async function request(path, method = 'GET', cookie = '', body, origin = fixture.url) {
  return fetch(fixture.url + '/api/v1' + path, { method, headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function check(response, status, name) { assert.equal(response.status, status, name); checks.push({ name, status }); return response; }
async function login(role) {
  const account = fixture.accounts.find(item => item.role === role);
  assert.equal(account.email, `ui-${role.toLowerCase()}@example.test`);
  return (await check(await request('/auth/login', 'POST', '', { email: account.email, password: account.password }), 200, role + ' login')).headers.get('set-cookie').split(';')[0];
}
const admin = await login('ADMIN'); const staff = await login('STAFF');
const carrier = await (await check(await request('/admin/catalogs/carriers', 'POST', admin, { code: randomUUID(), name: 'UI kiểm thử xóa SIM' }), 201, 'fixture carrier')).json();
const category = await (await check(await request('/admin/catalogs/sim-categories', 'POST', admin, { code: randomUUID(), name: 'UI kiểm thử xóa SIM' }), 201, 'fixture category')).json();
const sims = [];
for (const [index, stockStatus] of ['AVAILABLE', 'RESERVED', 'SOLD'].entries()) {
  const sim = await (await check(await request('/admin/sims', 'POST', admin, { phoneNumber: '00072900' + index, sellingPrice: '60', stockStatus,
    carrierId: carrier.id, categoryId: category.id, costPrice: '70', visibilityRequested: true }), 201, 'create ' + stockStatus)).json();
  sims.push(sim);
  const path = '/admin/sims/' + sim.id;
  const body = { version: sim.version };
  await check(await request(path, 'DELETE', '', body), 401, 'anonymous DELETE ' + stockStatus);
  await check(await request(path, 'DELETE', staff, body), 403, 'STAFF DELETE ' + stockStatus);
  await check(await request(path, 'DELETE', staff, { ...body, eligible: true, orderStatus: 'COMPLETED', confirmed: true }), 403, 'STAFF forged authority ' + stockStatus);
  await check(await request(path, 'DELETE', admin, body, 'http://evil.example.test'), 403, 'Origin rejected ' + stockStatus);
  await check(await request(path, 'DELETE', admin, { version: sim.version + 1 }), 409, 'stale version ' + stockStatus);
  const removed = await (await check(await request(path, 'DELETE', admin, { ...body, reason: 'Kiểm thử proxy' }), 200, 'ADMIN DELETE ' + stockStatus)).json();
  assert.deepEqual(Object.keys(removed).sort(), ['deletedAt', 'id', 'version']);
  await check(await request(path, 'DELETE', admin, body), 404, 'repeat DELETE ' + stockStatus);
  const lookup = await (await check(await request('/admin/check-sim?phoneNumber=' + sim.phoneNumber, 'GET', admin), 200, 'removed lookup ' + stockStatus)).json();
  assert.equal(lookup.item, null);
}
const alerts = await (await check(await request('/admin/alerts/sim-pricing', 'GET', admin), 200, 'archived alerts retained')).json();
for (const sim of sims) assert(alerts.items.some(item => item.simId === sim.id && item.deletedAt));
const uiSim = await (await check(await request('/admin/sims', 'POST', admin, { phoneNumber: '0007290099', sellingPrice: '60', stockStatus: 'RESERVED',
  carrierId: carrier.id, categoryId: category.id, costPrice: '70', visibilityRequested: true }), 201, 'UI removal candidate')).json();
await writeFile(join(projectRoot, '.local/batch07-removal-proxy-results.json'), JSON.stringify({ createdAt: new Date().toISOString(), checks, sims, uiSim }), { mode: 0o600 });
console.info('Batch 07 removal proxy checks passed: ' + checks.length);
