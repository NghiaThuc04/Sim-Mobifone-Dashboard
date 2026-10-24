import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/create-app';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { hashPassword } from '../src/users/password';
import { hashSessionToken, readSessionCookie } from '../src/auth/session-token';
import { AuthRepository } from '../src/auth/auth.repository';
import { InitAdminService } from '../src/users/init-admin.service';

const config = readConfig();
const db = new DatabaseService(config);
const password = randomBytes(24).toString('base64url');
let hash: string;
let app: INestApplication;
let origin: string;
let userId: string;
before(async () => {
  hash = await hashPassword(password);
  app = await createApp(false);
  await app.listen(0, '127.0.0.1');
  origin = await app.getUrl();
});
beforeEach(async () => {
  await db.authSession.deleteMany();
  await db.loginLimit.deleteMany();
  await db.user.deleteMany();
  const user = await db.user.create({ data: { email: 'login@example.test', fullName: 'Login test', role: 'ADMIN', passwordHash: hash } });
  userId = user.id;
});
after(async () => { await app.close(); await db.$disconnect(); });

async function login(body: unknown = { email: 'login@example.test', password }, headers: Record<string, string> = {}, url = origin) {
  return fetch(url + '/api/v1/auth/login', { method: 'POST',
    headers: { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

test('valid login returns explicit public DTO and HttpOnly cookie; DB only stores token HMAC', async () => {
  const response = await login({ email: ' LOGIN@EXAMPLE.TEST ', password });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const cookie = response.headers.get('set-cookie')!;
  assert(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict') && cookie.includes('Path=/'));
  assert(!cookie.includes('Domain=') && !cookie.includes('Secure'));
  const token = readSessionCookie(cookie.split(';')[0], 'sim_dashboard_session')!;
  assert.equal(token.length, 43);
  const body = await response.json() as { user: Record<string, unknown>; expiresAt: string };
  assert.deepEqual(Object.keys(body.user).sort(), ['email', 'fullName', 'id', 'permissions', 'role']);
  assert(!JSON.stringify(body).includes(hash));
  assert(!JSON.stringify(body).includes(token));
  const session = await db.authSession.findUniqueOrThrow({ where: { tokenHash: hashSessionToken(token, config.SESSION_SECRET) } });
  assert.equal(session.userId, userId);
  assert.notEqual(session.tokenHash, token);
  assert.equal(session.expiresAt.toISOString(), body.expiresAt);
  assert(Math.abs(session.expiresAt.getTime() - Date.now() - config.SESSION_TTL_SECONDS * 1000) < 5000);
});

test('wrong password, unknown email and locked account return identical 401 and no cookie', async () => {
  const wrong = await login({ email: 'login@example.test', password: 'wrong' });
  const missing = await login({ email: 'unknown@example.test', password: 'wrong' });
  await db.user.update({ where: { id: userId }, data: { status: 'locked' } });
  const locked = await login();
  const expected = await wrong.text();
  assert.equal(await missing.text(), expected);
  assert.equal(await locked.text(), expected);
  for (const response of [wrong, missing, locked]) {
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal(await db.authSession.count(), 0);
});

test('STAFF can login but cannot supply role or status to change authorization', async () => {
  await db.user.update({ where: { id: userId }, data: { role: 'STAFF' } });
  const response = await login();
  assert.equal(response.status, 200);
  const body = await response.json() as { user: { role: string } };
  assert.equal(body.user.role, 'STAFF');
  assert.equal((await login({ email: 'login@example.test', password, role: 'ADMIN' })).status, 400);
});

test('login renews the supplied session instead of reusing its token', async () => {
  const first = await login();
  const cookie = first.headers.get('set-cookie')!.split(';')[0];
  const second = await login(undefined, { Cookie: cookie });
  assert.equal(second.status, 200);
  assert.notEqual(second.headers.get('set-cookie')!.split(';')[0], cookie);
  assert.equal(await db.authSession.count({ where: { userId } }), 1);
});

test('invalid body, SQL-like email and oversized input are rejected safely', async () => {
  for (const input of [null, {}, { email: "' OR 1=1 --", password }, { email: 'login@example.test', password: 'x'.repeat(129) }]) {
    assert.equal((await login(input)).status, 400);
  }
  const oversized = await login({ email: 'login@example.test', password: 'marker'.repeat(2000) });
  assert.equal(oversized.status, 413);
  assert(!(await oversized.text()).includes('marker'));
  const malformed = await fetch(origin + '/api/v1/auth/login', { method: 'POST',
    headers: { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: '{private-body-marker' });
  assert.equal(malformed.status, 400);
  assert(!(await malformed.text()).includes('private-body-marker'));
});

test('foreign/missing Origin and form requests cannot create a login session', async () => {
  const requests: Record<string, string>[] = [{ Origin: 'https://evil.example.test' }, { Origin: '' }, { 'Content-Type': 'application/x-www-form-urlencoded' }];
  for (const headers of requests) {
    assert.equal((await login(undefined, headers)).status, 403);
  }
  assert.equal(await db.authSession.count(), 0);
});

test('persistent account limiter enforces threshold and Retry-After before password work', async () => {
  const limitsApp = await createApp(false, { ...config, LOGIN_ACCOUNT_MAX: 2, LOGIN_IP_MAX: 20 });
  await limitsApp.listen(0, '127.0.0.1');
  try {
    const url = await limitsApp.getUrl();
    assert.equal((await login({ email: 'login@example.test', password: 'wrong' }, {}, url)).status, 401);
    assert.equal((await login({ email: 'login@example.test', password: 'wrong' }, {}, url)).status, 401);
    const blocked = await login(undefined, {}, url);
    assert.equal(blocked.status, 429);
    assert(Number(blocked.headers.get('retry-after')) > 0);
    assert.equal(await db.authSession.count(), 0);
    await db.loginLimit.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await login(undefined, {}, url)).status, 200);
  } finally { await limitsApp.close(); }
});

test('IP limit cannot be bypassed by switching email or spoofing X-Forwarded-For', async () => {
  const limitsApp = await createApp(false, { ...config, LOGIN_ACCOUNT_MAX: 10, LOGIN_IP_MAX: 1 });
  await limitsApp.listen(0, '127.0.0.1');
  try {
    const url = await limitsApp.getUrl();
    assert.equal((await login({ email: 'one@example.test', password }, { 'X-Forwarded-For': '192.0.2.1' }, url)).status, 401);
    assert.equal((await login({ email: 'two@example.test', password }, { 'X-Forwarded-For': '192.0.2.2' }, url)).status, 429);
  } finally { await limitsApp.close(); }
});

test('concurrent attempts cannot pass the persistent account threshold', async () => {
  const limitsApp = await createApp(false, { ...config, LOGIN_ACCOUNT_MAX: 2, LOGIN_IP_MAX: 20 });
  await limitsApp.listen(0, '127.0.0.1');
  try {
    const url = await limitsApp.getUrl();
    const responses = await Promise.all(Array.from({ length: 4 }, () => login({ email: 'unknown@example.test', password }, {}, url)));
    assert.deepEqual(responses.map((response) => response.status).sort(), [401, 401, 429, 429]);
  } finally { await limitsApp.close(); }
});

test('production sets Secure __Host cookie; missing session secret is rejected', async () => {
  const production = { ...config, NODE_ENV: 'production' as const, FRONTEND_ORIGIN: 'https://dashboard.example.test' };
  const secureApp = await createApp(false, production);
  await secureApp.listen(0, '127.0.0.1');
  try {
    const response = await login(undefined, { Origin: production.FRONTEND_ORIGIN }, await secureApp.getUrl());
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')!;
    assert(cookie.startsWith('__Host-sim_dashboard_session='));
    assert(cookie.includes('Secure') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict'));
  } finally { await secureApp.close(); }
  assert.throws(() => readConfig({ ...process.env, NODE_ENV: 'production', SESSION_SECRET: '' }));
});

test('stale password or locked status cannot mint a session after credential verification', async () => {
  const repository = new AuthRepository(db);
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(randomBytes(24).toString('hex')) } });
  assert.equal(await repository.createSession(userId, hash, 'a'.repeat(64), 60), null);
  await db.user.update({ where: { id: userId }, data: { passwordHash: hash, status: 'locked' } });
  assert.equal(await repository.createSession(userId, hash, 'b'.repeat(64), 60), null);
});

test('password rotation revokes sessions and rejects the previous password', async () => {
  assert.equal((await login()).status, 200);
  const nextPassword = randomBytes(24).toString('hex');
  await new InitAdminService(db).rotatePassword({ email: 'login@example.test', password: nextPassword });
  assert.equal(await db.authSession.count({ where: { userId } }), 0);
  assert.equal((await login()).status, 401);
  assert.equal((await login({ email: 'login@example.test', password: nextPassword })).status, 200);
});

test('session constraints reject invalid token hash, missing user and invalid expiry', async () => {
  await assert.rejects(db.authSession.create({ data: { userId, tokenHash: 'raw-token', expiresAt: new Date(Date.now() + 60000) } }));
  await assert.rejects(db.authSession.create({ data: { userId, tokenHash: 'c'.repeat(64), expiresAt: new Date(0) } }));
  await assert.rejects(db.authSession.create({ data: { userId: '00000000-0000-4000-8000-000000000001', tokenHash: 'd'.repeat(64), expiresAt: new Date(Date.now() + 60000) } }));
});

