import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { projectRoot } from './postgres.mjs';

const fixture = JSON.parse(await readFile(join(projectRoot, '.local/ui-current.json'), 'utf8'));
assert.equal(fixture.url, 'http://127.0.0.1:3110');
const checks = [];
function request(path, method = 'GET', cookie = '', body, origin = fixture.url) {
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
const carrier = await (await check(await request('/admin/catalogs/carriers', 'POST', admin, { code: randomUUID(), name: 'UI kiểm thử nhà mạng' }), 201, 'fixture carrier')).json();
const category = await (await check(await request('/admin/catalogs/sim-categories', 'POST', admin, { code: randomUUID(), name: 'UI kiểm thử loại SIM' }), 201, 'fixture category')).json();
const sims = [];
for (const [phoneNumber, sellingPrice, stockStatus] of [['0007700001', '60000', 'AVAILABLE'], ['0007700002', '100000', 'RESERVED'], ['0007700003', '100000', 'SOLD']]) {
  sims.push(await (await check(await request('/admin/sims', 'POST', admin, { phoneNumber, sellingPrice, stockStatus, carrierId: carrier.id, categoryId: category.id, costPrice: '70000', visibilityRequested: true }), 201, 'fixture ' + stockStatus)).json());
}
const alerts = await (await check(await request('/admin/alerts/sim-pricing', 'GET', admin), 200, 'ADMIN alerts')).json();
assert.equal(alerts.openCount, 1); assert.equal(alerts.items[0].difference, '-10000'); assert.equal(alerts.items[0].costPrice, '70000');
const staffAlerts = await (await check(await request('/admin/alerts/sim-pricing', 'GET', staff), 200, 'STAFF alerts')).json();
assert(!JSON.stringify(staffAlerts).includes('costPrice')); assert(!JSON.stringify(staffAlerts).includes('costSnapshot'));
for (const cookie of [admin, staff]) {
  const data = await (await check(await request('/admin/check-sim?phoneNumber=' + sims[0].phoneNumber, 'GET', cookie), 200, 'exact check')).json();
  assert.equal(data.item.id, sims[0].id); assert.equal(data.item.removal.allowed, cookie === admin);
  if (cookie === staff) assert(!JSON.stringify(data).includes('costPrice'));
}
assert.equal((await (await check(await request('/admin/check-sim?phoneNumber=987654321', 'GET', admin), 200, 'lookup miss')).json()).item, null);
await check(await request('/admin/check-sim?phoneNumber=%25', 'GET', admin), 400, 'wildcard rejected');
await check(await request('/admin/alerts/sim-pricing?status=bad', 'GET', admin), 400, 'bad alert filter');
await check(await request('/admin/check-sim?phoneNumber=123'), 401, 'anonymous lookup');
await check(await request('/admin/alerts/sim-pricing'), 401, 'anonymous alerts');
await check(await request('/admin/sims/' + sims[0].id, 'GET', staff), 403, 'STAFF cannot open edit');
await check(await request('/public/sims', 'GET', admin), 404, 'no storefront');
await writeFile(join(projectRoot, '.local/batch07-ui-results.json'), JSON.stringify({ createdAt: new Date().toISOString(), checks, sims, carrier, category }), { mode: 0o600 });
console.info('Batch 07 Next proxy checks passed: ' + checks.length);
