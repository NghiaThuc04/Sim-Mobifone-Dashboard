import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthBounds } from '../src/common/calendar';
test('Vietnam month bounds preserve declared years 0001–0099 and roll leap/year boundaries correctly', () => {
  for (const [month, from, until] of [
    ['0001-01', '0000-12-31T17:00:00.000Z', '0001-01-31T17:00:00.000Z'],
    ['0099-12', '0099-11-30T17:00:00.000Z', '0099-12-31T17:00:00.000Z'],
    ['2024-02', '2024-01-31T17:00:00.000Z', '2024-02-29T17:00:00.000Z'],
  ]) {
    const result = monthBounds(month); assert.equal(result.from.toISOString(), from); assert.equal(result.until.toISOString(), until);
  }
});
