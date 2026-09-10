import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deductReported, addDatedQuantity, removeFromExpiry, itemPresent } from '../public/assets/js/core/crash-cart-batch-math.js';

/* A crash cart is counted twice — the item's own count, and the sum of its
   batches. These keep the two telling the same story while a department reports
   consumption and the pharmacy answers it. */

const deps = { now: () => '2026-03-01T09:00:00.000Z', actor: () => 'Ali', newId: () => 'ccb_fixed' };
const item = (over = {}) => ({
  id: 'i1', name: 'Adrenaline', qty: 6, present: 6,
  batches: [
    { batchId: 'b1', expiry: '2026-06-01', qty: 2 },
    { batchId: 'b2', expiry: '2027-01-01', qty: 4 },
  ],
  ...over,
});

test('the earliest expiry is deducted first when no batch was named', () => {
  const cart = item();
  const result = deductReported(cart, 3, '', deps);
  assert.deepEqual(result.deductionBatches.map((b) => [b.batchId, b.qty]), [['b1', 2], ['b2', 1]]);
  assert.deepEqual(cart.batches.map((b) => [b.batchId, b.qty]), [['b2', 3]]);
  assert.equal(cart.present, 3);
  assert.equal(cart.stockStatus, 'partial');
});

test('a nurse who named the box she used is not overruled', () => {
  /* Even though an earlier expiry exists, the named one is what came out. */
  const cart = item();
  const result = deductReported(cart, 2, '2027-01-01', deps);
  assert.deepEqual(result.deductionBatches.map((b) => b.batchId), ['b2']);
  assert.equal(cart.batches.find((b) => b.batchId === 'b1').qty, 2, 'the earlier batch is untouched');
});

test('a named batch that cannot cover the quantity is refused', () => {
  assert.throws(() => deductReported(item(), 5, '2026-06-01', deps), /does not contain enough quantity/);
});

test('a quantity the batches cannot account for is recorded, not dropped', () => {
  /* The report has to say that this much left the cart with no batch behind it,
     or putting it back later invents a batch that never existed. */
  const cart = item({ present: 6, batches: [{ batchId: 'b1', expiry: '2026-06-01', qty: 1 }] });
  const result = deductReported(cart, 4, '', deps);
  assert.equal(result.untrackedDeductedQty, 3);
  assert.equal(result.deductedQty, 4);
  assert.equal(cart.present, 2, 'the count still moves by the full reported quantity');
  assert.deepEqual(cart.batches, []);
});

test('a report for more than the cart holds is refused outright', () => {
  assert.throws(() => deductReported(item({ present: 2 }), 5, '', deps), /exceeds the current cart quantity/);
});

test('an emptied item reads as out of stock, and a full one as available', () => {
  const emptied = item();
  deductReported(emptied, 6, '', deps);
  assert.equal(emptied.present, 0);
  assert.equal(emptied.stockStatus, 'out_of_stock');

  const untouched = item();
  deductReported(untouched, 0, '', deps);
  assert.equal(untouched.stockStatus, 'available');
});

test('who deducted and when is stamped on the item', () => {
  const cart = item();
  deductReported(cart, 1, '', deps);
  assert.equal(cart.updatedAt, '2026-03-01T09:00:00.000Z');
  assert.equal(cart.updatedBy, 'Ali');
});

test('a replacement merges into the pharmacy\'s own batch for that expiry', () => {
  /* Top-ups accumulate in one row instead of one row per report. */
  const cart = item({ batches: [{ id: 'x', expiry: '2027-01-01', qty: 1, lot: '' }] });
  addDatedQuantity(cart, '2027-01-01', 3, 'rep-1', deps);
  assert.equal(cart.batches.length, 1);
  assert.equal(cart.batches[0].qty, 4);
  assert.equal(cart.batches[0].sourceReportId, 'rep-1');
});

test('a batch carrying a lot number stays separate — a lot is a fact about a delivery', () => {
  const cart = item({ batches: [{ id: 'x', expiry: '2027-01-01', qty: 1, lot: 'L-9' }] });
  addDatedQuantity(cart, '2027-01-01', 3, 'rep-1', deps);
  assert.equal(cart.batches.length, 2);
  assert.equal(cart.batches.find((b) => b.lot === 'L-9').qty, 1);
});

test('batches stay in expiry order after a replacement', () => {
  const cart = item({ batches: [{ id: 'x', expiry: '2027-01-01', qty: 1, lot: '' }] });
  addDatedQuantity(cart, '2026-05-01', 2, 'rep-1', deps);
  assert.deepEqual(cart.batches.map((b) => b.expiry), ['2026-05-01', '2027-01-01']);
});

test('adding nothing adds nothing', () => {
  const cart = item();
  const before = JSON.stringify(cart.batches);
  addDatedQuantity(cart, '2027-01-01', 0, 'rep-1', deps);
  addDatedQuantity(cart, '2027-01-01', -5, 'rep-1', deps);
  assert.equal(JSON.stringify(cart.batches), before);
});

test('a correction removes from one named expiry and refuses to spill into another', () => {
  const cart = item();
  removeFromExpiry(cart, '2026-06-01', 2);
  assert.deepEqual(cart.batches.map((b) => b.batchId), ['b2'], 'the emptied batch is gone');
  assert.throws(() => removeFromExpiry(item(), '2026-06-01', 3), /does not contain enough quantity/);
});

test('an item marked out of stock with no count holds none', () => {
  assert.equal(itemPresent({ qty: 6, stockStatus: 'out_of_stock' }), 0);
});
