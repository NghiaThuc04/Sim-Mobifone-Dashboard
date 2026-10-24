import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/create-app';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { hashPassword } from '../src/users/password';

const config = readConfig();
const db = new DatabaseService(config);
const password = randomBytes(24).toString('hex');
let app: INestApplication;
let origin: string;
let userId: string;
before(async () => { app = await createApp(false); await app.listen(0, '127.0.0.1'); origin = await app.getUrl(); });
beforeEach(async () => {
  await db.user.deleteMany(); await db.loginLimit.deleteMany();
  userId = (await db.user.create({ data: { email: 'session@example.test', fullName: 'Session test', role: 'ADMIN', passwordHash: await hashPassword(password) } })).id;
});
after(async () => { await app.close(); await db.$disconnect(); });
async function login() {
  const response = await fetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'session@example.test', password }) });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie')!.split(';')[0];
}
function me(cookie = '') { return fetch(origin + '/api/v1/auth/me', { headers: { Cookie: cookie } }); }
function logout(cookie = '', originHeader = config.FRONTEND_ORIGIN) { return fetch(origin + '/api/v1/auth/logout', { method: 'POST', headers: { Cookie: cookie, Origin: originHeader } }); }

test('ADMIN and STAFF me returns current account and role, logout revokes replayed cookie', async () => {
  for (const role of ['ADMIN', 'STAFF'] as const) {
    await db.user.update({ where: { id: userId }, data: { role } });
    const cookie = await login();
    const response = await me(cookie);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json() as { user: { id: string; role: string } };
    assert.equal(body.user.id, userId); assert.equal(body.user.role, role);
    assert.deepEqual(Object.keys(body.user).sort(), ['email', 'fullName', 'id', 'permissions', 'role']);
    const result = await logout(cookie); assert.equal(result.status, 204);
    assert(result.headers.get('set-cookie')!.includes('Expires=Thu, 01 Jan 1970'));
    assert.equal((await me(cookie)).status, 401);
    assert.equal((await logout(cookie)).status, 204);
  }
});

test('missing, malformed, unknown or expired session cannot read me', async () => {
  for (const cookie of ['', 'sim_dashboard_session=bad', `sim_dashboard_session=${'a'.repeat(43)}`]) assert.equal((await me(cookie)).status, 401);
  const cookie = await login();
  await db.authSession.updateMany({ data: { createdAt: new Date(Date.now() - 120000), expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await me(cookie)).status, 401);
});

test('role changes take effect immediately and locked/deleted users lose session access', async () => {
  const cookie = await login();
  await db.user.update({ where: { id: userId }, data: { role: 'STAFF' } });
  assert.equal(((await (await me(cookie)).json()) as { user: { role: string } }).user.role, 'STAFF');
  await db.user.update({ where: { id: userId }, data: { status: 'locked' } });
  assert.equal((await me(cookie)).status, 401);
  await db.user.delete({ where: { id: userId } });
  assert.equal((await me(cookie)).status, 401);
});

test('logout without session is safe, but foreign Origin cannot revoke a session', async () => {
  assert.equal((await logout()).status, 204);
  const cookie = await login();
  assert.equal((await logout(cookie, 'https://evil.example.test')).status, 403);
  assert.equal((await me(cookie)).status, 200);
});

