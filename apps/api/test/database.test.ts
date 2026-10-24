import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/create-app';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';

test('DB health pings PostgreSQL through Prisma', async () => {
  const app = await createApp(false);
  await app.listen(0, '127.0.0.1');
  try {
    const response = await fetch((await app.getUrl()) + '/api/v1/health/db');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', database: 'up' });
  } finally { await app.close(); }
});

test('DB outage returns safe 503 while liveness stays available', async () => {
  const config = readConfig({ ...process.env, DATABASE_URL: 'postgresql://test:private-marker@127.0.0.1:1/unavailable' });
  const app = await createApp(false, config);
  await app.listen(0, '127.0.0.1');
  try {
    const origin = await app.getUrl();
    const response = await fetch(origin + '/api/v1/health/db');
    assert.equal(response.status, 503);
    const body = await response.text();
    assert(!body.includes('private-marker'));
    assert(!body.includes('postgresql://'));
    assert.equal((await fetch(origin + '/api/v1/health')).status, 200);
  } finally { await app.close(); }
});

test('database boundary binds UTC even with a non-UTC URL, and timestamp matches PostgreSQL epoch', async () => {
  const connection = new URL(process.env.DATABASE_URL!);
  connection.searchParams.set('options', '-c timezone=Asia/Bangkok');
  const db = new DatabaseService(readConfig({ ...process.env, DATABASE_URL: connection.toString() }));
  try {
    const [clock] = await db.$queryRaw<{ at: Date; epoch: number; zone: string }[]>`
      SELECT clock_timestamp() AS at, extract(epoch FROM clock_timestamp())::float8 AS epoch, current_setting('TimeZone') AS zone`;
    assert.equal(clock.zone, 'UTC');
    assert(Math.abs(clock.at.getTime() - clock.epoch * 1000) < 1000);
    assert(Math.abs(clock.at.getTime() - Date.now()) < 3000);
  } finally { await db.$disconnect(); }
});
