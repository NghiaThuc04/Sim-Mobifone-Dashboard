import { beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { DatabaseService } from '../src/database/database.service';
import { readConfig } from '../src/config';
import { InitAdminService } from '../src/users/init-admin.service';
import { hashPassword, verifyPassword } from '../src/users/password';

const db = new DatabaseService(readConfig());
const service = new InitAdminService(db);
const input = () => ({ email: 'bootstrap@example.test', fullName: 'Test Admin', password: randomBytes(24).toString('base64url') });
beforeEach(async () => { await db.user.deleteMany(); });
after(async () => { await db.$disconnect(); });

test('bootstrap creates one active ADMIN with hash, reruns do not change any account', async () => {
  const data = input();
  assert.equal(await service.initialize(data), 'created');
  const user = await db.user.findUniqueOrThrow({ where: { email: data.email } });
  assert.equal(user.role, 'ADMIN');
  assert.equal(user.status, 'active');
  assert.notEqual(user.passwordHash, data.password);
  assert(await verifyPassword(data.password, user.passwordHash));
  assert.equal(await service.initialize({ ...data, email: 'other@example.test' }), 'already-initialized');
  assert.equal(await db.user.count(), 1);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, user.passwordHash);
});

test('two concurrent initializations produce exactly one ADMIN', async () => {
  const data = input();
  const results = await Promise.all([service.initialize(data), service.initialize({ ...data, email: 'second@example.test' })]);
  assert.deepEqual(results.sort(), ['already-initialized', 'created']);
  assert.equal(await db.user.count({ where: { role: 'ADMIN' } }), 1);
});

test('invalid passwords and an existing STAFF email are refused without escalation', async () => {
  const data = input();
  for (const password of ['', 'short', '             ']) await assert.rejects(service.initialize({ ...data, password }));
  await db.user.create({ data: { email: data.email, fullName: 'Staff test', passwordHash: await hashPassword(data.password), role: 'STAFF' } });
  await assert.rejects(service.initialize(data));
  assert.equal(await db.user.count({ where: { role: 'ADMIN' } }), 0);
});

test('operator can rotate an existing Admin password without creating another account', async () => {
  const data = input();
  await service.initialize(data);
  const nextPassword = randomBytes(24).toString('base64url');
  await service.rotatePassword({ email: data.email, password: nextPassword });
  const user = await db.user.findUniqueOrThrow({ where: { email: data.email } });
  assert(await verifyPassword(nextPassword, user.passwordHash));
  assert.equal(await verifyPassword(data.password, user.passwordHash), false);
  assert.equal(await db.user.count(), 1);
  await assert.rejects(service.rotatePassword({ email: 'missing@example.test', password: nextPassword }));
});

test('CLI seed succeeds and never logs plaintext password or hash', async () => {
  const data = input();
  const child = spawn(process.execPath, [resolve(__dirname, '../src/cli/init-admin.js')], {
    env: { ...process.env, ADMIN_EMAIL: data.email, ADMIN_FULL_NAME: data.fullName, ADMIN_PASSWORD: data.password },
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (value: Buffer) => { output += value.toString(); });
  child.stderr.on('data', (value: Buffer) => { output += value.toString(); });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  assert.equal(code, 0);
  assert(output.includes('Initial Admin created'));
  assert(!output.includes(data.password));
  assert(!output.includes('$scrypt$'));
  assert.equal(await db.user.count(), 1);
});
