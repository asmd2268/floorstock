import assert from 'node:assert/strict';
import { test } from 'node:test';

import { consumeBatches, mergeBatches } from '../public/assets/js/core/controlled-batch-consumption.js';

/* Taking a dispensed quantity out of controlled batches. This decides which
   physical box leaves the cupboard, and it was two very long lines with no
   test. */

test('the batch closest to expiring leaves first', () => {
  const { used, remaining } = consumeBatches([
    { expiry: '2027-01-01', qty: 5, lot: 'B' },
    { expiry: '2026-06-01', qty: 5, lot: 'A' },
  ], 3);
  assert.deepEqual(used, [{ qty: 3, expiry: '2026-06-01', lot: 'A' }]);
  assert.deepEqual(remaining.map((b) => [b.lot, b.qty]), [['A', 2], ['B', 5]]);
});

test('a dispense spanning two batches empties the nearer one first', () => {
  const { used, remaining, short } = consumeBatches([
    { expiry: '2026-06-01', qty: 4, lot: 'A' },
    { expiry: '2027-01-01', qty: 10, lot: 'B' },
  ], 6);
  assert.deepEqual(used, [
    { qty: 4, expiry: '2026-06-01', lot: 'A' },
    { qty: 2, expiry: '2027-01-01', lot: 'B' },
  ]);
  assert.deepEqual(remaining.map((b) => [b.lot, b.qty]), [['B', 8]], 'the emptied batch is gone');
  assert.equal(short, 0);
});

test('a batch with no expiry recorded is dispensed LAST, not first', () => {
  /* It is not known to be old. Sending it out ahead of a dated batch pushes a
     real expiry closer to the edge on the strength of a missing field. */
  const { used } = consumeBatches([
    { expiry: '', qty: 10, lot: 'unknown' },
    { expiry: '2026-06-01', qty: 2, lot: 'dated' },
  ], 3);
  assert.deepEqual(used.map((b) => b.lot), ['dated', 'unknown']);
  assert.deepEqual(used.map((b) => b.qty), [2, 1]);
});

test('a shortfall is reported, never absorbed', () => {
  /* Dispensing more than the batches account for leaves a cupboard whose total
     no longer matches the sum of what is in it. */
  const { used, remaining, short } = consumeBatches([{ expiry: '2026-06-01', qty: 2 }], 5);
  assert.equal(short, 3);
  assert.equal(used[0].qty, 2);
  assert.deepEqual(remaining, []);
});

test('no batches at all is entirely short', () => {
  assert.deepEqual(consumeBatches([], 4), { remaining: [], used: [], short: 4 });
  assert.deepEqual(consumeBatches(null, 4).short, 4);
});

test('dispensing nothing takes nothing and leaves everything', () => {
  const batches = [{ expiry: '2026-06-01', qty: 5, lot: 'A' }];
  const { used, remaining, short } = consumeBatches(batches, 0);
  assert.deepEqual(used, []);
  assert.equal(short, 0);
  assert.deepEqual(remaining.map((b) => b.qty), [5]);
});

test('the batches passed in are not modified — the caller decides whether to save', () => {
  const batches = [{ expiry: '2026-06-01', qty: 5, lot: 'A' }];
  consumeBatches(batches, 5);
  assert.equal(batches[0].qty, 5);
});

test('a batch with a nonsense quantity contributes nothing rather than NaN', () => {
  const { used, short } = consumeBatches([{ expiry: '2026-01-01', qty: 'x' }, { expiry: '2026-06-01', qty: 2 }], 3);
  assert.deepEqual(used, [{ qty: 2, expiry: '2026-06-01', lot: '' }]);
  assert.equal(short, 1);
});

test('the same expiry and lot arriving twice is one batch holding more', () => {
  const merged = mergeBatches(
    [{ expiry: '2026-06-01', lot: 'A', qty: 3 }],
    [{ expiry: '2026-06-01', lot: 'A', qty: 4 }, { expiry: '2027-01-01', lot: 'B', qty: 1 }],
  );
  assert.deepEqual(merged, [
    { qty: 7, expiry: '2026-06-01', lot: 'A' },
    { qty: 1, expiry: '2027-01-01', lot: 'B' },
  ]);
});

test('the same expiry under a different lot stays two batches', () => {
  const merged = mergeBatches([{ expiry: '2026-06-01', lot: 'A', qty: 1 }], [{ expiry: '2026-06-01', lot: 'B', qty: 1 }]);
  assert.equal(merged.length, 2);
});

test('a merged row that ends at zero is dropped', () => {
  assert.deepEqual(mergeBatches([{ expiry: '2026-06-01', lot: 'A', qty: 0 }], []), []);
  assert.deepEqual(mergeBatches(null, null), []);
});

test('what was consumed can be handed straight to the receiving department', () => {
  const { used } = consumeBatches([
    { expiry: '2026-06-01', qty: 4, lot: 'A' },
    { expiry: '2027-01-01', qty: 4, lot: 'B' },
  ], 6);
  const departmentHeld = mergeBatches([{ expiry: '2026-06-01', lot: 'A', qty: 1 }], used);
  assert.deepEqual(departmentHeld, [
    { qty: 5, expiry: '2026-06-01', lot: 'A' },
    { qty: 2, expiry: '2027-01-01', lot: 'B' },
  ]);
});
