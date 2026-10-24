import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/create-app';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { hashPassword, verifyPassword } from '../src/users/password';
import { AUDIT_ACTIONS } from '../src/audit/audit.service';

const config = readConfig();
const db = new DatabaseService(config);
const password = 'Only test password 4321!';
let app: INestApplication;
let origin: string;
let hash: string;
let adminCookie: string;
let staffCookie: string;
let adminId: string;
let staffId: string;
before(async () => { hash = await hashPassword(password); app = await createApp(false); await app.listen(0, '127.0.0.1'); origin = await app.getUrl(); });
beforeEach(async () => {
  await db.user.deleteMany(); await db.loginLimit.deleteMany();
  adminId = (await db.user.create({ data: { email: 'manage-admin@example.test', fullName: 'Admin test', role: 'ADMIN', passwordHash: hash } })).id;
  staffId = (await db.user.create({ data: { email: 'manage-staff@example.test', fullName: 'Staff test', role: 'STAFF', passwordHash: hash } })).id;
  adminCookie = (await login('manage-admin@example.test')).headers.get('set-cookie')!.split(';')[0];
  staffCookie = (await login('manage-staff@example.test')).headers.get('set-cookie')!.split(';')[0];
});
after(async () => { await app.close(); await db.$disconnect(); });
function login(email: string, value = password) { return fetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: value }) }); }
function write(path: string, body: unknown, method = 'POST', cookie = adminCookie, requestOrigin = config.FRONTEND_ORIGIN) {
  return fetch(origin + '/api/v1/admin/employees' + path, { method, headers: { Cookie: cookie, Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function me(cookie: string) { return fetch(origin + '/api/v1/auth/me', { headers: { Cookie: cookie } }); }
const newEmployee = () => ({ fullName: 'Nhân viên kiểm thử', email: `create-${randomUUID()}@example.test`, password });

test('P11 ADMIN creates STAFF, safely hashes password, audits, and new account logs in', async () => {
  const input = newEmployee();
  const response = await write('', { ...input, email: input.email.toUpperCase() });
  assert.equal(response.status, 201); assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json() as { id: string; role: string; email: string };
  assert.equal(result.role, 'STAFF'); assert.equal(result.email, input.email);
  assert(!JSON.stringify(result).includes('password'));
  const stored = await db.user.findUniqueOrThrow({ where: { id: result.id } });
  assert(await verifyPassword(password, stored.passwordHash)); assert.notEqual(stored.passwordHash, hash);
  assert.equal((await login(input.email)).status, 200);
  const event = await db.auditLog.findFirstOrThrow({ where: { targetId: result.id, action: AUDIT_ACTIONS.EMPLOYEE_CREATED } });
  assert.equal(event.actorId, adminId); assert(!JSON.stringify(event).includes(password));
});

test('P11 validates input, rejects role escalation and duplicate normalized email including races', async () => {
  for (const input of [{}, { ...newEmployee(), fullName: ' ' }, { ...newEmployee(), email: 'bad' }, { ...newEmployee(), password: 'short' }, { ...newEmployee(), role: 'ADMIN' }]) assert.equal((await write('', input)).status, 400);
  const input = newEmployee();
  const responses = await Promise.all([write('', input), write('', { ...input, email: input.email.toUpperCase() })]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.equal(await db.user.count({ where: { email: input.email } }), 1);
});

test('P11 rejects STAFF, anonymous and foreign/missing Origin; audit failure rolls back creation', async () => {
  assert.equal(((await (await me(staffCookie)).json()) as { user: { id: string } }).user.id, staffId);
  assert.equal((await write('', newEmployee(), 'POST', staffCookie)).status, 403);
  assert.equal((await write('', newEmployee(), 'POST', '')).status, 401);
  for (const requestOrigin of ['', 'https://invalid.example']) assert.equal((await write('', newEmployee(), 'POST', adminCookie, requestOrigin)).status, 403);
  const input = newEmployee();
  await db.$executeRaw`CREATE FUNCTION reject_employee_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'EMPLOYEE_CREATED' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`;
  await db.$executeRaw`CREATE TRIGGER reject_employee_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_employee_audit()`;
  try { assert.equal((await write('', input)).status, 503); }
  finally {
    await db.$executeRaw`DROP TRIGGER reject_employee_audit ON audit_logs`;
    await db.$executeRaw`DROP FUNCTION reject_employee_audit()`;
  }
  assert.equal(await db.user.count({ where: { email: input.email } }), 0);
});

test('P12 lock revokes old sessions, denies login; unlock allows a new session but never revives old cookies', async () => {
  assert.equal((await write(`/${staffId}/status`, { status: 'locked' }, 'PATCH')).status, 200);
  assert.equal(await db.authSession.count({ where: { userId: staffId } }), 0);
  assert.equal((await me(staffCookie)).status, 401);
  assert.equal((await login('manage-staff@example.test')).status, 401);
  assert.equal((await write(`/${staffId}/status`, { status: 'active' }, 'PATCH')).status, 200);
  assert.equal((await me(staffCookie)).status, 401);
  assert.equal((await login('manage-staff@example.test')).status, 200);
  const events = await db.auditLog.findMany({ where: { targetId: staffId, action: AUDIT_ACTIONS.EMPLOYEE_STATUS_CHANGED }, orderBy: { createdAt: 'asc' } });
  assert.equal(events.length, 2); assert(events.every((event) => event.actorId === adminId));
  assert.deepEqual(events.map((event) => event.metadata), [
    { previousStatus: 'active', status: 'locked', source: 'api' }, { previousStatus: 'locked', status: 'active', source: 'api' },
  ]);
});

test('P12 rejects STAFF/anonymous, bad input/id, missing targets and ADMIN targets; keeps unrelated sessions', async () => {
  const path = `/${staffId}/status`;
  assert.equal((await write(path, { status: 'locked' }, 'PATCH', staffCookie)).status, 403);
  assert.equal((await write(path, { status: 'locked' }, 'PATCH', '')).status, 401);
  assert.equal((await write(path, { status: 'locked' }, 'PATCH', adminCookie, '')).status, 403);
  for (const input of [{}, { status: 'deleted' }, { status: 'locked', role: 'ADMIN' }]) assert.equal((await write(path, input, 'PATCH')).status, 400);
  assert.equal((await write('/invalid/status', { status: 'locked' }, 'PATCH')).status, 400);
  assert.equal((await write(`/${randomUUID()}/status`, { status: 'locked' }, 'PATCH')).status, 404);
  assert.equal((await write(`/${adminId}/status`, { status: 'locked' }, 'PATCH')).status, 400);
  assert.equal((await me(adminCookie)).status, 200); assert.equal((await me(staffCookie)).status, 200);
});

test('P12 audit failure rolls back status and session revocation together', async () => {
  await db.$executeRaw`CREATE FUNCTION reject_status_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'EMPLOYEE_STATUS_CHANGED' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`;
  await db.$executeRaw`CREATE TRIGGER reject_status_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_status_audit()`;
  try { assert.equal((await write(`/${staffId}/status`, { status: 'locked' }, 'PATCH')).status, 503); }
  finally { await db.$executeRaw`DROP TRIGGER reject_status_audit ON audit_logs`; await db.$executeRaw`DROP FUNCTION reject_status_audit()`; }
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: staffId } })).status, 'active');
  assert.equal((await me(staffCookie)).status, 200);
});

test('P13 reset accepts new password, rejects old password and sessions, touches only chosen STAFF', async () => {
  const next = 'New test passphrase 6428!';
  const response = await write(`/${staffId}/reset-password`, { password: next });
  assert.equal(response.status, 204); assert.equal(await response.text(), '');
  assert.equal((await me(staffCookie)).status, 401);
  assert.equal((await login('manage-staff@example.test')).status, 401);
  assert.equal((await login('manage-staff@example.test', next)).status, 200);
  assert.equal((await me(adminCookie)).status, 200);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: adminId } })).passwordHash, hash);
  const event = await db.auditLog.findFirstOrThrow({ where: { targetId: staffId, action: AUDIT_ACTIONS.EMPLOYEE_PASSWORD_RESET } });
  assert.equal(event.actorId, adminId);
  assert(!JSON.stringify(event).includes(next)); assert(!JSON.stringify(event).includes('$scrypt$'));
  const detail = await fetch(origin + `/api/v1/admin/employees/${staffId}`, { headers: { Cookie: adminCookie } });
  assert.equal(detail.status, 200); assert(!(await detail.text()).includes('password'));
});

test('P13 rejects STAFF, bad passwords, absent users and ADMIN reset targets', async () => {
  const path = `/${staffId}/reset-password`;
  assert.equal((await write(path, { password }, 'POST', staffCookie)).status, 403);
  assert.equal((await write(path, { password }, 'POST', '')).status, 401);
  assert.equal((await write(path, { password }, 'POST', adminCookie, '')).status, 403);
  for (const input of [{}, { password: 'short' }, { password: ' '.repeat(12) }, { password, role: 'ADMIN' }]) assert.equal((await write(path, input)).status, 400);
  assert.equal((await write(`/${randomUUID()}/reset-password`, { password })).status, 404);
  assert.equal((await write(`/${adminId}/reset-password`, { password })).status, 400);
  assert.equal((await me(staffCookie)).status, 200);
});

test('P13 audit failure preserves password and existing sessions atomically', async () => {
  await db.$executeRaw`CREATE FUNCTION reject_reset_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'EMPLOYEE_PASSWORD_RESET' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`;
  await db.$executeRaw`CREATE TRIGGER reject_reset_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_reset_audit()`;
  try { assert.equal((await write(`/${staffId}/reset-password`, { password: 'New rollback test password!' })).status, 503); }
  finally { await db.$executeRaw`DROP TRIGGER reject_reset_audit ON audit_logs`; await db.$executeRaw`DROP FUNCTION reject_reset_audit()`; }
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: staffId } })).passwordHash, hash);
  assert.equal((await me(staffCookie)).status, 200);
});
