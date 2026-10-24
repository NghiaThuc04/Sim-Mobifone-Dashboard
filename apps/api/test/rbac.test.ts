import 'reflect-metadata';
import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { Controller, Get, Module, INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Account, PERMISSIONS, USER_ROLES, STAFF_PERMISSIONS } from '@sim-dashboard/shared';
import { AppModule } from '../src/app.module';
import { configureHttp } from '../src/create-app';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { hashPassword } from '../src/users/password';
import { RequirePermission } from '../src/authorization/access.decorators';
import { AuthorizationService } from '../src/authorization/authorization.service';

let ownerId: string;
@Controller('rbac-fixture')
class FixtureController {
  @Get('admin') @RequirePermission(PERMISSIONS.EMPLOYEES_ADMIN) admin() { return { allowed: true }; }
  @Get('view') @RequirePermission(PERMISSIONS.ORDERS_VIEW) view() { return { allowed: true }; }
  @Get('own') @RequirePermission(PERMISSIONS.ORDERS_UPDATE_OWN, () => ({ ownerId })) own() { return { allowed: true }; }
}
const config = readConfig();
@Module({ imports: [AppModule.register(config)], controllers: [FixtureController] }) class TestModule {}
const db = new DatabaseService(config);
let app: INestApplication;
let origin: string;
let cookie: string;
let userId: string;
before(async () => {
  app = await NestFactory.create(TestModule, { logger: false, bodyParser: false }); configureHttp(app, config);
  await app.listen(0, '127.0.0.1'); origin = await app.getUrl();
});
beforeEach(async () => {
  await db.user.deleteMany(); await db.loginLimit.deleteMany();
  userId = (await db.user.create({ data: { email: 'rbac@example.test', fullName: 'RBAC fixture', role: 'STAFF', passwordHash: await hashPassword('Only test passphrase 823!') } })).id;
  ownerId = userId;
  const response = await fetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'rbac@example.test', password: 'Only test passphrase 823!' }) });
  assert.equal(response.status, 200); cookie = response.headers.get('set-cookie')!.split(';')[0];
});
after(async () => { await app.close(); await db.$disconnect(); });
function get(path: string, cookieValue = cookie, extra = {}) { return fetch(origin + '/api/v1/rbac-fixture/' + path, { headers: { Cookie: cookieValue, ...extra } }); }

test('direct requests enforce 401, STAFF 403 and ADMIN access; spoofed role is ignored', async () => {
  assert.equal((await get('admin', '')).status, 401);
  assert.equal((await get('admin', cookie, { 'X-Role': 'ADMIN' })).status, 403);
  assert.equal((await get('view')).status, 200);
  await db.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
  assert.equal((await get('admin')).status, 200);
  await db.user.update({ where: { id: userId }, data: { role: 'STAFF' } });
  assert.equal((await get('admin')).status, 403);
});

test('resource ownership is checked server-side and ADMIN bypass requires a valid session', async () => {
  assert.equal((await get('own')).status, 200);
  ownerId = 'another-user'; assert.equal((await get('own')).status, 403);
  await db.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
  assert.equal((await get('own')).status, 200);
  await db.authSession.deleteMany(); assert.equal((await get('own')).status, 401);
});

test('permission matrix denies unknown ownership/eligibility and gives ADMIN known permissions', () => {
  const service = new AuthorizationService();
  const staff: Account = { id: 'staff', email: 'staff@example.test', fullName: 'Test', role: USER_ROLES.STAFF, permissions: [...STAFF_PERMISSIONS] };
  for (const permission of Object.values(PERMISSIONS)) service.assertAllowed({ ...staff, role: USER_ROLES.ADMIN }, permission);
  for (const permission of [PERMISSIONS.FINANCE_ADMIN, PERMISSIONS.EMPLOYEES_ADMIN, PERMISSIONS.SETTINGS_ADMIN]) assert.throws(() => service.assertAllowed(staff, permission));
  assert.throws(() => service.assertAllowed(staff, PERMISSIONS.ORDERS_UPDATE_OWN));
  assert.throws(() => service.assertAllowed(staff, PERMISSIONS.SIMS_DELETE_ELIGIBLE));
  service.assertAllowed(staff, PERMISSIONS.ORDERS_UPDATE_OWN, { ownerId: 'staff' });
  service.assertAllowed(staff, PERMISSIONS.SIMS_DELETE_ELIGIBLE, { eligible: true });
  for (const permission of [PERMISSIONS.PAYROLL_VIEW_SELF, PERMISSIONS.LEAVES_VIEW_SELF]) {
    assert.throws(() => service.assertAllowed(staff, permission));
    assert.throws(() => service.assertAllowed(staff, permission, { ownerId: 'someone-else' }));
    service.assertAllowed(staff, permission, { ownerId: staff.id });
  }
});
