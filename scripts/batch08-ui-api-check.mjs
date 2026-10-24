import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { projectRoot } from './postgres.mjs';

const fixture = JSON.parse(await readFile(join(projectRoot, '.local/ui-current.json'), 'utf8'));
assert.equal(fixture.url, 'http://127.0.0.1:3110');
assert(resolve(fixture.directory).startsWith(join(projectRoot, '.local', 'ui-test-')));
assert(resolve(fixture.directory).startsWith(join(projectRoot, '.local') + sep));
const checks = [];
function request(path, method = 'GET', cookie = '', body, origin = fixture.url) {
  return fetch(fixture.url + '/api/v1' + path, { method, headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function check(response, status, name) { assert.equal(response.status, status, name); checks.push({ name, status }); return response; }
async function login(role) {
  const account = fixture.accounts.find(item => item.role === role); assert.equal(account.email, `ui-${role.toLowerCase()}@example.test`);
  return (await check(await request('/auth/login', 'POST', '', { email: account.email, password: account.password }), 200, role + ' login')).headers.get('set-cookie').split(';')[0];
}
const admin = await login('ADMIN'); const staff = await login('STAFF');
const initial = await (await check(await request('/admin/orders', 'GET', admin), 200, 'initial orders empty')).json(); assert.equal(initial.total, 0);
await check(await request('/admin/staff-sim-submissions', 'POST', staff, { costPrice: '1' }), 501, 'STAFF upload placeholder');
await check(await request('/admin/staff-sim-submissions', 'POST', '', {}), 401, 'anonymous upload');
await check(await request('/admin/sims', 'POST', staff, { costPrice: '1' }), 403, 'STAFF cannot create stock');
const carrier = await (await check(await request('/admin/catalogs/carriers', 'POST', admin, { code: randomUUID(), name: 'Batch 08 UI test' }), 201, 'fixture carrier')).json();
const category = await (await check(await request('/admin/catalogs/sim-categories', 'POST', admin, { code: randomUUID(), name: 'Batch 08 UI test' }), 201, 'fixture category')).json();
const sims = []; const orders = [];
for (let index = 0; index < 3; index++) {
  const sim = await (await check(await request('/admin/sims', 'POST', admin, { phoneNumber: '000831000' + index, costPrice: '70', sellingPrice: '100',
    visibilityRequested: true, carrierId: carrier.id, categoryId: category.id }), 201, 'fixture SIM ' + index)).json(); sims.push(sim);
  const body = { idempotencyKey: randomUUID(), simId: sim.id, customer: { fullName: 'Khách UI kiểm thử ' + index, phone: '0008400' + index } };
  if (index === 0) {
    await check(await request('/admin/internal-orders', 'POST', staff, body), 403, 'STAFF internal create denied');
    await check(await request('/admin/internal-orders', 'POST', '', body), 401, 'anonymous internal create denied');
    await check(await request('/admin/internal-orders', 'POST', admin, body, 'http://evil.example.test'), 403, 'Origin rejected');
    const pair = await Promise.all([request('/admin/internal-orders', 'POST', admin, body), request('/admin/internal-orders', 'POST', admin, body)]);
    const first = await (await check(pair[0], 201, 'concurrent create')).json();
    assert.deepEqual(await (await check(pair[1], 201, 'concurrent replay')).json(), first); orders.push(first);
    await check(await request('/admin/internal-orders', 'POST', admin, { ...body, customer: { ...body.customer, fullName: 'Different payload' } }), 409, 'key payload conflict');
  } else orders.push(await (await check(await request('/admin/internal-orders', 'POST', admin, body), 201, 'create order ' + index)).json());
}

// Explicit fixture-only state setup for read UI; no assignment/completion endpoint is being implemented.
const metadata = JSON.parse(await readFile(join(fixture.directory, 'cluster.json'), 'utf8'));
assert.equal(metadata.database, 'dashboard_ui_test');
const require = createRequire(import.meta.url);
const { DatabaseService } = require('../apps/api/dist/src/database/database.service.js');
const { readConfig } = require('../apps/api/dist/src/config.js');
const db = new DatabaseService(readConfig({ ...process.env, NODE_ENV: 'test', DATABASE_URL: `postgresql://postgres:${encodeURIComponent(metadata.password)}@127.0.0.1:${metadata.port}/${metadata.database}`,
  SESSION_SECRET: randomBytes(48).toString('hex'), FRONTEND_ORIGIN: fixture.url, INTERNAL_ORDER_CREATION_ENABLED: 'true' }));
let staffId;
try {
  const account = await db.user.findUniqueOrThrow({ where: { email: 'ui-staff@example.test' } }); staffId = account.id;
  await db.order.update({ where: { id: orders[1].id }, data: { status: 'PROCESSING', assignedStaffId: staffId, claimedAt: new Date() } });
  await db.order.update({ where: { id: orders[2].id }, data: { status: 'COMPLETED', assignedStaffId: staffId, claimedAt: new Date(), completedAt: new Date(), completedBy: staffId } });
} finally { await db.$disconnect(); }

const list = await (await check(await request('/admin/orders', 'GET', admin), 200, 'ADMIN orders')).json(); assert.equal(list.total, 3); assert.equal(list.items[0].firstItem.costPrice, '70');
const staffList = await (await check(await request('/admin/orders', 'GET', staff), 200, 'STAFF orders')).json(); assert.equal(staffList.total, 3);
for (const forbidden of ['costPrice', 'cost_price', '0008400', 'requestHash', 'idempotencyKey']) assert(!JSON.stringify(staffList).includes(forbidden));
const filtered = await (await check(await request('/admin/orders?status=PROCESSING&assignedStaffId=' + staffId, 'GET', staff), 200, 'status and staff filter')).json(); assert.equal(filtered.total, 1);
const byPhone = await (await check(await request('/admin/orders?phoneNumber=' + sims[0].phoneNumber, 'GET', admin), 200, 'SIM snapshot filter')).json(); assert.equal(byPhone.total, 1);
const page = await (await check(await request('/admin/orders?pageSize=1', 'GET', admin), 200, 'pagination')).json(); assert.equal(page.totalPages, 3); assert.equal(page.items.length, 1);
const outside = await (await check(await request('/admin/orders?page=999', 'GET', admin), 200, 'outside page')).json(); assert.equal(outside.items.length, 0); assert.equal(outside.total, 3);
await check(await request('/admin/orders?status=bad', 'GET', admin), 400, 'invalid filter');
await check(await request('/admin/orders'), 401, 'anonymous list');
await check(await request('/admin/orders/' + orders[0].id + '/claim', 'POST', staff, {}), 201, 'claim now implemented in Batch09');
await check(await request('/admin/orders/' + orders[0].id + '/status', 'PATCH', staff, {}), 409, 'invalid status remains rejected');
await check(await request('/admin/sims/' + sims[2].id, 'DELETE', staff, { version: sims[2].version + 1 }), 403, 'STAFF deletion remains blocked even for COMPLETED fixture');
await check(await request('/public/orders', 'POST', '', {}), 404, 'no public checkout');
await writeFile(join(projectRoot, '.local/batch08-ui-results.json'), JSON.stringify({ createdAt: new Date().toISOString(), checks, orders, sims, staffId,
  note: 'PROCESSING/COMPLETED are isolated fixture states, not runtime transition/financial verification.' }), { mode: 0o600 });
console.info('Batch 08 Next proxy checks passed: ' + checks.length);
