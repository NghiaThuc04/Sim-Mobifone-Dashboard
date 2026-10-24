import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { projectRoot } from './postgres.mjs';
import { STAFF_PERMISSIONS, PERMISSIONS } from '../packages/shared/dist/index.js';

// This harness intentionally accepts only the isolated UI fixture, never the local business database.
const fixture = JSON.parse(await readFile(join(projectRoot, '.local/ui-current.json'), 'utf8'));
assert.equal(fixture.url, 'http://127.0.0.1:3110');
const base = fixture.url + '/api/v1';
const checks = [];
function request(path, method = 'GET', cookie = '', body, origin = fixture.url) {
  return fetch(base + path, { method, headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function expect(response, status, name) {
  assert.equal(response.status, status, name); checks.push({ name, status }); return response;
}
async function login(email, password, status = 200) {
  return expect(await request('/auth/login', 'POST', '', { email, password }), status, 'proxy login');
}
function cookie(response) { return response.headers.get('set-cookie')?.split(';')[0] ?? ''; }
const admin = fixture.accounts.find((account) => account.role === 'ADMIN');
const staff = fixture.accounts.find((account) => account.role === 'STAFF');
const adminCookie = cookie(await login(admin.email, admin.password));
const staffCookie = cookie(await login(staff.email, staff.password));
const adminUser = (await (await request('/auth/me', 'GET', adminCookie)).json()).user;
const staffUser = (await (await request('/auth/me', 'GET', staffCookie)).json()).user;
assert.equal(adminUser.fullName, 'UI kiểm thử ADMIN'); assert.equal(staffUser.fullName, 'UI kiểm thử STAFF');
const input = { fullName: 'UI kiểm thử HTTP proxy', email: `proxy-${randomUUID()}@example.test`, password: randomBytes(24).toString('hex') };
const createdResponse = await expect(await request('/admin/employees', 'POST', adminCookie, input), 201, 'create STAFF via Next');
const created = await createdResponse.json(); assert.equal(created.role, 'STAFF'); assert(!JSON.stringify(created).includes('password'));
const target = '/admin/employees/' + created.id;
await expect(await request('/admin/employees', 'POST', adminCookie, input), 409, 'duplicate');
await expect(await request('/admin/employees', 'POST', staffCookie, input), 403, 'STAFF create forbidden');
await expect(await request(target + '/status', 'PATCH', adminCookie, { status: 'locked' }, 'https://invalid.example'), 403, 'foreign Origin');
let employeeCookie = cookie(await login(input.email, input.password));
await expect(await request(target + '/status', 'PATCH', adminCookie, { status: 'locked' }), 200, 'lock');
await expect(await request('/auth/me', 'GET', employeeCookie), 401, 'locked session rejected');
await login(input.email, input.password, 401);
await expect(await request(target + '/status', 'PATCH', adminCookie, { status: 'active' }), 200, 'unlock');
await expect(await request('/auth/me', 'GET', employeeCookie), 401, 'old session remains revoked');
employeeCookie = cookie(await login(input.email, input.password));
const nextPassword = randomBytes(24).toString('hex');
await expect(await request(target + '/reset-password', 'POST', adminCookie, { password: nextPassword }), 204, 'reset');
await expect(await request('/auth/me', 'GET', employeeCookie), 401, 'reset revokes session');
await login(input.email, input.password, 401);
employeeCookie = cookie(await login(input.email, nextPassword));
for (const path of ['/permissions', '/commission-policy']) {
  await expect(await request(target + path, 'GET', employeeCookie), 403, 'STAFF read administration forbidden');
}
const matrix = { permissions: STAFF_PERMISSIONS.map((permission) => ({ permission, enabled: permission !== PERMISSIONS.SIMS_VIEW && permission !== PERMISSIONS.ORDERS_VIEW })) };
await expect(await request(`/admin/employees/${staffUser.id}/permissions`, 'PUT', adminCookie, matrix), 200, 'live permission matrix');
const effective = (await (await request('/auth/me', 'GET', staffCookie)).json()).user;
assert(!effective.permissions.includes(PERMISSIONS.SIMS_VIEW)); assert(!effective.permissions.includes(PERMISSIONS.ORDERS_VIEW));
await expect(await request(target + '/permissions', 'PUT', employeeCookie, matrix), 403, 'self escalation forbidden');
await expect(await request(target + '/commission-policy', 'PUT', adminCookie, { ratePercent: '12.123456789012345678901234567891' }), 200, 'exact decimal policy');
await expect(await request(target + '/commission-policy', 'PUT', employeeCookie, { ratePercent: '90' }), 403, 'STAFF rate forbidden');
const history = await (await expect(await request(target + '/commission-policy', 'GET', adminCookie), 200, 'commission history')).json();
assert.equal(history.current.ratePercent, '12.123456789012345678901234567891');
await expect(await request('/admin/sims', 'GET', adminCookie), 200, 'ADMIN inventory endpoint');
await expect(await request('/auth/logout', 'POST', employeeCookie), 204, 'logout');
await expect(await request('/auth/me', 'GET', employeeCookie), 401, 'cookie replay');
await writeFile(join(projectRoot, '.local/ui-proxy-results.json'), JSON.stringify({ createdAt: new Date().toISOString(), checks, fixtureStaffId: staffUser.id }), { mode: 0o600 });
console.info(`Next proxy integration passed: ${checks.length} assertions; only isolated UI fixture accounts were changed.`);
