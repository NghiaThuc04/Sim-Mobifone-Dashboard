import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config';

test('validated env rejects missing/invalid values without leaking secrets', () => {
  const secret = 'sensitive-password-marker';
  assert.throws(() => readConfig({ DATABASE_URL: secret }), (error: unknown) => {
    assert(error instanceof Error);
    assert(error.message.includes('DATABASE_URL'));
    assert(error.message.includes('SESSION_SECRET'));
    assert(!error.message.includes(secret));
    return true;
  });
  assert.throws(() => readConfig({ ...process.env, PORT: '0' }));
  assert.throws(() => readConfig({ ...process.env, NODE_ENV: 'production', SESSION_SECRET: '' }));
  assert.throws(() => readConfig({ ...process.env, NODE_ENV: 'production' }));
  assert.equal(readConfig().NODE_ENV, 'test');
});
