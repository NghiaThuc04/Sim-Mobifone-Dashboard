import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { readConfig } from '../src/config';
import { hashPassword, verifyPassword } from '../src/users/password';
import { userIdentitySchema } from '../src/users/user-input';

const db = new DatabaseService(readConfig());
let hash: string;
before(async () => { hash = await hashPassword('Test-only passphrase 742!'); });
after(async () => { await db.$disconnect(); });

test('scrypt hashes have random salt and validate correct/wrong passwords', async () => {
  const other = await hashPassword('Test-only passphrase 742!');
  assert.notEqual(hash, other);
  assert(!hash.includes('Test-only'));
  assert(await verifyPassword('Test-only passphrase 742!', hash));
  assert.equal(await verifyPassword('incorrect', hash), false);
  assert.equal(await verifyPassword('x', 'plaintext'), false);
  await assert.rejects(hashPassword('weak'));
});

test('identity validation normalizes emails and rejects invalid inputs', () => {
  assert.deepEqual(userIdentitySchema.parse({ email: ' Alice@Example.test ', fullName: ' Alice ' }),
    { email: 'alice@example.test', fullName: 'Alice' });
  assert.equal(userIdentitySchema.safeParse({ email: 'bad-email', fullName: 'A' }).success, false);
  assert.equal(userIdentitySchema.safeParse({ email: 'a@example.test', fullName: ' ' }).success, false);
});

test('migration creates users and enforces unique normalized email with real PostgreSQL', async () => {
  const email = `unique-${randomUUID()}@example.test`;
  const user = await db.user.create({ data: { email, fullName: 'Constraint test', passwordHash: hash, role: 'STAFF' } });
  assert.equal(user.status, 'active');
  assert(user.createdAt instanceof Date && user.updatedAt instanceof Date);
  await assert.rejects(db.user.create({ data: { email, fullName: 'Duplicate', passwordHash: hash, role: 'ADMIN' } }));
  await assert.rejects(db.user.create({ data: { email: email.toUpperCase(), fullName: 'Duplicate case', passwordHash: hash, role: 'STAFF' } }));
});

test('database rejects invalid email, blank name, plaintext password, role and status', async () => {
  const base = { email: `invalid-${randomUUID()}@example.test`, fullName: 'Constraint test', passwordHash: hash, role: 'STAFF' as const };
  await assert.rejects(db.user.create({ data: { ...base, email: 'invalid' } }));
  await assert.rejects(db.user.create({ data: { ...base, fullName: ' ' } }));
  await assert.rejects(db.user.create({ data: { ...base, passwordHash: 'plaintext' } }));
  await assert.rejects(db.$executeRaw`INSERT INTO users (id,email,full_name,password_hash,role,status,updated_at)
    VALUES (${randomUUID()}::uuid, ${base.email}, 'Test', ${hash}, 'OWNER', 'active', NOW())`);
  await assert.rejects(db.$executeRaw`INSERT INTO users (id,email,full_name,password_hash,role,status,updated_at)
    VALUES (${randomUUID()}::uuid, ${base.email}, 'Test', ${hash}, 'STAFF', 'enabled', NOW())`);
});
