import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { INestApplication } from '@nestjs/common';
import { HEALTH_ENDPOINT, HEALTH_STATUS } from '@sim-dashboard/shared';
import { createApp } from '../src/create-app';

let app: INestApplication;
let origin: string;

before(async () => {
  app = await createApp(false);
  await app.listen(0, '127.0.0.1');
  origin = await app.getUrl();
});

after(async () => {
  if (app) await app.close();
});

test('health endpoint is reachable over HTTP and returns only the basic status', async () => {
  const response = await fetch(origin + HEALTH_ENDPOINT);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: HEALTH_STATUS });
});

test('unimplemented business endpoints remain absent', async () => {
  for (const path of ['/api/v1/admin/not-implemented']) {
    assert.equal((await fetch(origin + path)).status, 404);
  }
  assert.equal((await fetch(origin+'/api/v1/admin/sims')).status,401);
  assert.equal((await fetch(origin+'/api/v1/admin/orders')).status,401);
});
