import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../src/database/database.service';
import { readConfig } from '../src/config';
import { AuditService, AUDIT_ACTIONS } from '../src/audit/audit.service';
import { createApp } from '../src/create-app';
import { hashPassword } from '../src/users/password';

const config = readConfig();
const db = new DatabaseService(config);
const audit = new AuditService(db);
let app: INestApplication;
let origin: string;
before(async () => { app = await createApp(false); await app.listen(0, '127.0.0.1'); origin = await app.getUrl(); });
after(async () => { await app.close(); await db.$disconnect(); });

test('audit is append-only in database and rejects secret-bearing metadata', async () => {
  const id = randomUUID();
  const created = await audit.append({ actorKind: 'USER', actorId: id, action: AUDIT_ACTIONS.ACCESS_DENIED,
    targetType: 'ACCESS', metadata: { reason: 'permission_denied' } });
  const record = await db.auditLog.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(record.actorId, id); assert(record.createdAt instanceof Date);
  await assert.rejects(db.auditLog.update({ where: { id: created.id }, data: { action: 'tampered' } }));
  await assert.rejects(db.auditLog.delete({ where: { id: created.id } }));
  await assert.rejects(db.$executeRaw`TRUNCATE TABLE audit_logs`);
  assert.throws(() => audit.append({ actorKind: 'SYSTEM', action: AUDIT_ACTIONS.LOGOUT, targetType: 'AUTH',
    metadata: JSON.parse('{"password":"private-marker","token":"private-marker"}') }));
});

test('successful/failed login and logout have accurate actor, action and no credential payload', async () => {
  await db.loginLimit.deleteMany();
  const email = `${randomUUID()}@example.test`;
  const password = randomBytes(24).toString('hex');
  const user = await db.user.create({ data: { email, fullName: 'Audit test', passwordHash: await hashPassword(password), role: 'ADMIN' } });
  async function login(value: string) { return fetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: value }) }); }
  const previousFailures = await db.auditLog.count({ where: { action: AUDIT_ACTIONS.LOGIN_FAILURE } });
  assert.equal((await login('incorrect-secret-marker')).status, 401);
  assert.equal(await db.auditLog.count({ where: { action: AUDIT_ACTIONS.LOGIN_FAILURE } }), previousFailures + 1);
  const response = await login(password); assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  const logout = await fetch(origin + '/api/v1/auth/logout', { method: 'POST', headers: { Origin: config.FRONTEND_ORIGIN, Cookie: cookie } });
  assert.equal(logout.status, 204);
  const records = await db.auditLog.findMany({ where: { actorId: user.id }, orderBy: { createdAt: 'asc' } });
  assert.deepEqual(records.map((row) => row.action), [AUDIT_ACTIONS.LOGIN_SUCCESS, AUDIT_ACTIONS.LOGOUT]);
  const serialized = JSON.stringify(records);
  for (const value of [password, cookie, 'incorrect-secret-marker', config.SESSION_SECRET]) assert(!serialized.includes(value));
  assert.equal((await fetch(origin + '/api/v1/audit-logs', { method: 'DELETE', headers: { Cookie: cookie } })).status, 404);
});

test('audit storage failure rolls back session creation; no successful cookie is issued', async () => {
  await db.loginLimit.deleteMany();
  const email = `${randomUUID()}@example.test`;
  const password = randomBytes(24).toString('hex');
  const user = await db.user.create({ data: { email, fullName: 'Rollback test', role: 'STAFF', passwordHash: await hashPassword(password) } });
  await db.$executeRaw`CREATE FUNCTION reject_test_login_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'AUTH_LOGIN_SUCCESS' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`;
  await db.$executeRaw`CREATE TRIGGER reject_test_login_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_test_login_audit()`;
  try {
    const response = await fetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(await db.authSession.count({ where: { userId: user.id } }), 0);
    const body = await response.text(); assert(!body.includes(password)); assert(!body.includes('test audit failure'));
  } finally {
    await db.$executeRaw`DROP TRIGGER reject_test_login_audit ON audit_logs`;
    await db.$executeRaw`DROP FUNCTION reject_test_login_audit()`;
  }
});
