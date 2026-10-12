import assert from 'node:assert/strict';
import { test } from 'node:test';
import { waitUpTo } from '../public/assets/js/core/timing.js';

test('waitUpTo returns the value when it arrives in time', async () => {
  assert.equal(await waitUpTo(Promise.resolve(7), 50), 7);
});
test('waitUpTo gives up with "slow" instead of hanging on a weak link', async () => {
  assert.equal(await waitUpTo(new Promise(() => {}), 10), 'slow');
});
test('waitUpTo still throws a real rejection', async () => {
  await assert.rejects(waitUpTo(Promise.reject(new Error('denied')), 50), /denied/);
});
