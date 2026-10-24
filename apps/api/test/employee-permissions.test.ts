import 'reflect-metadata';
import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { Controller, Get, Module, INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Account, EmployeePermissionMatrix, PERMISSIONS, STAFF_PERMISSIONS } from '@sim-dashboard/shared';
import { AppModule } from '../src/app.module';
import { configureHttp } from '../src/create-app';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { hashPassword } from '../src/users/password';
import { RequirePermission } from '../src/authorization/access.decorators';
import { AUDIT_ACTIONS } from '../src/audit/audit.service';

let staffId: string;
@Controller('permissions-fixture') class FixtureController {}
// Real HTTP guards for every approved permission, mounted only in this test module.
for (const [index, permission] of STAFF_PERMISSIONS.entries()) {
  const method = `permission${index}`;
  const descriptor = { value: () => ({ allowed: true }), configurable: true };
  Object.defineProperty(FixtureController.prototype, method, descriptor);
  Get(String(index))(FixtureController.prototype, method, descriptor);
  RequirePermission(permission, () => ({ ownerId: staffId, eligible: true }))(FixtureController.prototype, method, descriptor);
}
const config = readConfig();
@Module({ imports: [AppModule.register(config)], controllers: [FixtureController] }) class TestModule {}
const db = new DatabaseService(config);
const password = 'Permissions test password 42!';
let app: INestApplication;
let origin: string;
let hash: string;
let adminCookie: string;
let staffCookie: string;
let adminId: string;
before(async () => {
  hash = await hashPassword(password);
  app = await NestFactory.create(TestModule, { logger: false, bodyParser: false }); configureHttp(app, config);
  await app.listen(0, '127.0.0.1'); origin = await app.getUrl();
});
beforeEach(async () => {
  await db.user.deleteMany(); await db.loginLimit.deleteMany();
  adminId = (await db.user.create({ data: { email: 'permission-admin@example.test', fullName: 'Admin test', role: 'ADMIN', passwordHash: hash } })).id;
  staffId = (await db.user.create({ data: { email: 'permission-staff@example.test', fullName: 'Staff test', role: 'STAFF', passwordHash: hash } })).id;
  async function login(email: string) {
    const response = await fetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(response.status, 200); return response.headers.get('set-cookie')!.split(';')[0];
  }
  adminCookie = await login('permission-admin@example.test'); staffCookie = await login('permission-staff@example.test');
});
after(async () => { await app.close(); await db.$disconnect(); });
function matrix(disabled: readonly string[] = []) { return { permissions: STAFF_PERMISSIONS.map((permission) => ({ permission, enabled: !disabled.includes(permission) })) }; }
function put(body: unknown, cookie = adminCookie) { return fetch(origin + `/api/v1/admin/employees/${staffId}/permissions`, { method: 'PUT', headers: { Cookie: cookie, Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
function get(path: string, cookie = staffCookie) { return fetch(origin + '/api/v1/' + path, { headers: { Cookie: cookie } }); }

test('P14 every STAFF default works through HTTP guards; each revoked permission takes effect on the same session', async () => {
  const initial = await (await get(`admin/employees/${staffId}/permissions`, adminCookie)).json() as EmployeePermissionMatrix;
  assert.deepEqual(initial.permissions, matrix().permissions);
  for (const [index, permission] of STAFF_PERMISSIONS.entries()) {
    assert.equal((await get(`permissions-fixture/${index}`)).status, 200, permission);
    assert.equal((await put(matrix([permission]))).status, 200);
    assert.equal((await get(`permissions-fixture/${index}`)).status, 403, permission);
    assert.equal((await get(`permissions-fixture/${index}`, adminCookie)).status, 200);
    const account = await (await get('auth/me')).json() as { user: Account };
    assert(!account.user.permissions.includes(permission)); assert(!JSON.stringify(account).includes('cost_price'));
    assert.equal((await put(matrix())).status, 200);
    assert.equal((await get(`permissions-fixture/${index}`)).status, 200);
  }
  const event = await db.auditLog.findFirstOrThrow({ where: { actorId: adminId, action: AUDIT_ACTIONS.EMPLOYEE_PERMISSIONS_CHANGED }, orderBy: { createdAt: 'desc' } });
  assert.equal(event.targetId, staffId); assert((event.metadata as { previousPermissions: string[] }).previousPermissions.length < STAFF_PERMISSIONS.length);
});

test('P14 rejects self escalation, administrative permissions, duplicates, unknown fields and invalid matrices', async () => {
  assert.equal((await put(matrix(), staffCookie)).status, 403);
  assert.equal((await put(matrix(), '')).status, 401);
  for (const body of [{ permissions: [] }, { ...matrix(), role: 'ADMIN' }, { permissions: [...matrix().permissions, { permission: PERMISSIONS.FINANCE_ADMIN, enabled: true }] },
    { permissions: matrix().permissions.map((item) => ({ ...item, permission: 'orders.view' })) },
    { permissions: matrix().permissions.map((item, index) => index ? item : { permission: 'settings.admin', enabled: true }) },
    { permissions: matrix().permissions.map((item) => ({ ...item, enabled: 'true' })) }]) assert.equal((await put(body)).status, 400);
  await assert.rejects(db.employeePermission.create({ data: { userId: staffId, permission: 'finance.admin', enabled: true, updatedBy: adminId } }));
  assert.equal((await get(`admin/employees/${staffId}/permissions`)).status, 403);
  assert.equal((await get('admin/employees')).status, 403);
  assert.equal(await db.employeePermission.count(), 0);
});

test('P14 failed audit rolls back permission matrix, and no future business endpoint is exposed', async () => {
  await db.$executeRaw`CREATE FUNCTION reject_permission_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'EMPLOYEE_PERMISSIONS_CHANGED' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`;
  await db.$executeRaw`CREATE TRIGGER reject_permission_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_permission_audit()`;
  try { assert.equal((await put(matrix(STAFF_PERMISSIONS))).status, 503); }
  finally { await db.$executeRaw`DROP TRIGGER reject_permission_audit ON audit_logs`; await db.$executeRaw`DROP FUNCTION reject_permission_audit()`; }
  assert.equal(await db.employeePermission.count(), 0);
  assert.equal((await get('permissions-fixture/0')).status, 200);
  for (const path of ['admin/finance/summary', 'admin/payroll']) assert.equal((await get(path, adminCookie)).status, 404);
  assert.equal((await get('admin/orders', adminCookie)).status, 200);
  assert.equal((await get('admin/sims',adminCookie)).status,200);
});
