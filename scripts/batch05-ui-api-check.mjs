import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { projectRoot } from './postgres.mjs';

// Only the isolated UI fixture is an allowed mutation target.
const fixture = JSON.parse(await readFile(join(projectRoot, '.local/ui-current.json'), 'utf8'));
assert.equal(fixture.url, 'http://127.0.0.1:3110');
const checks = [];
function request(path, method = 'GET', cookie = '', body) {
  return fetch(fixture.url + '/api/v1' + path, { method,
    headers: { Cookie: cookie, Origin: fixture.url, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function check(response, status, name) {
  assert.equal(response.status, status, name); checks.push({ name, status }); return response;
}
async function login(role) {
  const account = fixture.accounts.find((item) => item.role === role);
  assert.equal(account.email, `ui-${role.toLowerCase()}@example.test`);
  const result = await check(await request('/auth/login', 'POST', '', { email: account.email, password: account.password }), 200, role + ' login via proxy');
  return result.headers.get('set-cookie').split(';')[0];
}
const adminCookie = await login('ADMIN');
const staffCookie = await login('STAFF');
const staff = (await (await request('/auth/me', 'GET', staffCookie)).json()).user;
assert.equal(staff.fullName, 'UI kiểm thử STAFF');
const target = '/admin/employees/' + staff.id;
await check(await request(target + '/salary'), 401, 'anonymous salary rejected');
await check(await request(target + '/salary', 'PUT', adminCookie, { amount: '5000000', effectiveFrom: '2026-10-01T00:00:00+07:00' }), 200, 'initial salary');
await check(await request(target + '/salary', 'PUT', adminCookie, { amount: '6000000', effectiveFrom: '2035-11-01T00:00:00+07:00' }), 200, 'future salary');
const salary = await (await check(await request(target + '/salary?month=2026-10', 'GET', adminCookie), 200, 'salary history')).json();
assert.equal(salary.current.amount, '5000000'); assert.equal(salary.total, 1);
await check(await request(target + '/salary', 'PUT', staffCookie, { amount: '1' }), 403, 'STAFF salary write forbidden');
await check(await request(target + '/salary', 'GET', staffCookie), 403, 'STAFF salary admin read forbidden');
const leave = { fromDate: '2026-10-31', toDate: '2026-11-01', days: '1.5',
  reason: 'UI kiểm thử phân bổ qua tháng', notes: 'Chỉ dữ liệu kiểm thử',
  allocations: [{ month: '2026-10', days: '0.5' }, { month: '2026-11', days: '1' }] };
await check(await request(target + '/leaves', 'POST', adminCookie, leave), 201, 'cross-month confirmed leave');
await check(await request(target + '/leaves', 'POST', adminCookie, leave), 409, 'overlap cannot double count');
for (const [month, totalDays] of [['2026-10', '0.5'], ['2026-11', '1'], ['2026-12', '0']]) {
  const own = await (await check(await request('/me/leaves?month=' + month, 'GET', staffCookie), 200, 'own leave ' + month)).json();
  assert.equal(own.totalDays, totalDays);
  for (const key of ['employeeId', 'createdBy', 'password', 'salary', 'costPrice']) assert(!JSON.stringify(own).includes(key));
}
await check(await request('/me/leaves?employeeId=' + randomUUID(), 'GET', staffCookie), 400, 'owner injection rejected');
await check(await request(target + '/leaves', 'GET', staffCookie), 403, 'STAFF admin leave forbidden');
await check(await request('/me/leaves', 'POST', staffCookie, leave), 404, 'self leaves read-only');
for (const kind of ['carriers', 'sim-categories']) {
  const path = '/admin/catalogs/' + kind;
  const input = { code: 'ui-' + randomUUID(), name: 'UI kiểm thử ' + kind };
  const item = await (await check(await request(path, 'POST', adminCookie, input), 201, 'create ' + kind)).json();
  await check(await request(path, 'POST', adminCookie, input), 409, 'duplicate ' + kind);
  await check(await request(path + '/' + item.id, 'PUT', adminCookie, { ...input, name: input.name + ' đã cập nhật' }), 200, 'update ' + kind);
  await check(await request(path, 'GET', staffCookie), 200, 'STAFF catalog read ' + kind);
  await check(await request(path, 'POST', staffCookie, input), 403, 'STAFF catalog write denied ' + kind);
  await check(await request(path + '/' + randomUUID(), 'DELETE', adminCookie, {}), 404, 'missing catalog delete ' + kind);
}
await check(await request('/admin/sims', 'GET', adminCookie), 200, 'ADMIN inventory after P22');
await check(await request('/auth/logout', 'POST', staffCookie), 204, 'STAFF logout');
await check(await request('/auth/me', 'GET', staffCookie), 401, 'logged-out cookie rejected');
await writeFile(join(projectRoot, '.local/batch05-ui-results.json'), JSON.stringify({ createdAt: new Date().toISOString(), checks, fixtureStaffId: staff.id }), { mode: 0o600 });
console.info('Batch 05 Next proxy checks passed: ' + checks.length);
