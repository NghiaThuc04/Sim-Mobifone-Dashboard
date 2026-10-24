import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import type { INestApplication } from '@nestjs/common';
import type { EmployeeList } from '@sim-dashboard/shared';
import { createApp } from '../src/create-app';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { hashPassword } from '../src/users/password';
import { AUDIT_ACTIONS } from '../src/audit/audit.service';

const config = readConfig();
const db = new DatabaseService(config);
let app: INestApplication;
let origin: string;
let hash: string;
let cookie: string;
let adminId: string;
before(async () => { hash = await hashPassword('Only test password 4321!'); app = await createApp(false); await app.listen(0, '127.0.0.1'); origin = await app.getUrl(); });
beforeEach(async () => {
  await db.user.deleteMany(); await db.loginLimit.deleteMany();
  adminId = (await db.user.create({ data: { email: 'employees-admin@example.test', fullName: 'Admin fixture', role: 'ADMIN', passwordHash: hash } })).id;
  for (let i = 0; i < 23; i++) await db.user.create({ data: { email: `employee-${i}@example.test`, fullName: `Nhân viên test ${i}`, role: 'STAFF', status: i % 3 === 0 ? 'locked' : 'active', passwordHash: hash } });
  const response = await fetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'employees-admin@example.test', password: 'Only test password 4321!' }) });
  assert.equal(response.status, 200); cookie = response.headers.get('set-cookie')!.split(';')[0];
});
after(async () => { await app.close(); await db.$disconnect(); });
function list(query = '', cookieValue = cookie) { return fetch(origin + '/api/v1/admin/employees' + query, { headers: { Cookie: cookieValue } }); }

test('employees API is ADMIN-only and directly rejects STAFF/anonymous', async () => {
  assert.equal((await list('', '')).status, 401);
  assert.equal((await list()).status, 200);
  await db.user.update({ where: { id: adminId }, data: { role: 'STAFF' } });
  assert.equal((await list()).status, 403);
});

test('list paginates stably and projects only basic account fields', async () => {
  const firstResponse = await list('?page=1&pageSize=10');
  assert.equal(firstResponse.headers.get('cache-control'), 'no-store');
  const first = await firstResponse.json() as EmployeeList;
  const second = await (await list('?page=2&pageSize=10')).json() as EmployeeList;
  assert.equal(first.total, 24); assert.equal(first.totalPages, 3); assert.equal(first.items.length, 10);
  assert.equal(second.items.length, 10);
  assert(first.items.every((item) => !second.items.some((other) => other.id === item.id)));
  assert.deepEqual(Object.keys(first.items[0]).sort(), ['commissionRatePercent', 'createdAt', 'email', 'fullName', 'id', 'role', 'status']);
  assert(!JSON.stringify(first).includes('$scrypt$'));
  assert.equal((await (await list('?page=99&pageSize=10')).json() as EmployeeList).items.length, 0);
});

test('role/status filters, case insensitive name/email search and empty results', async () => {
  const filtered = await (await list('?role=STAFF&status=locked')).json() as EmployeeList;
  assert.equal(filtered.total, 8); assert(filtered.items.every((item) => item.role === 'STAFF' && item.status === 'locked'));
  const name = await (await list('?search=' + encodeURIComponent('NHÂN VIÊN TEST 22'))).json() as EmployeeList;
  assert.equal(name.total, 1);
  const email = await (await list('?search=EMPLOYEES-ADMIN')).json() as EmployeeList;
  assert.equal(email.total, 1); assert.equal(email.items[0].id, adminId);
  assert.equal((await (await list('?search=no-match-unique')).json() as EmployeeList).total, 0);
  assert.equal((await (await list('?search=%25')).json() as EmployeeList).total, 0);
});

test('bad filters/pagination are rejected and query-like text is treated as data', async () => {
  for (const query of ['?page=0', '?page=-1', '?page=1.5', '?pageSize=101', '?role=OWNER', '?status=deleted', '?sort=password_hash', '?page=1&page=2']) assert.equal((await list(query)).status, 400);
  const response = await list('?search=' + encodeURIComponent("'; DROP TABLE users; --"));
  assert.equal(response.status, 200); assert.equal((await response.json() as EmployeeList).total, 0);
  assert.equal(await db.user.count(), 24);
});

test('employee list access is audited without storing search text; unrelated mutations stay absent', async () => {
  assert.equal((await list('?search=private-search-marker')).status, 200);
  const audit = await db.auditLog.findFirstOrThrow({ where: { actorId: adminId, action: AUDIT_ACTIONS.EMPLOYEES_VIEWED } });
  assert.equal((audit.metadata as { hasSearch: boolean }).hasSearch, true);
  assert(!JSON.stringify(audit).includes('private-search-marker'));
  for (const method of ['PATCH', 'DELETE']) assert.equal((await fetch(origin + '/api/v1/admin/employees', { method, headers: { Cookie: cookie, Origin: config.FRONTEND_ORIGIN } })).status, 404);
});

