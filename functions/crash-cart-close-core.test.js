'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const core = require('./crash-cart-close-core');

/* The pharmacy's answer used to be computed in the browser and written as two
   separate documents. These tests are about the two things that made that
   wrong: the arithmetic was not checked by anything, and the pair was not
   atomic. */

const STAMP = '2026-09-09T10:00:00.000Z';
const ACTOR = { name: 'Ahmed', login: 'ahmed@hospital', id: 'u1' };

function fixture(overrides) {
  return Object.assign({
    carts: [{
      id: 'cart1', seal: 'OLD', items: [
        { id: 'i1', name: 'Magnesium Sulfate', qty: 2, present: 2, batches: [{ expiry: '2026-11-30', qty: 2 }] },
        { id: 'i2', name: 'Lidocaine', qty: 2, present: 1, batches: [{ expiry: '2027-01-31', qty: 1 }] },
      ],
    }],
    reports: [{ id: 'r1', cartId: 'cart1', status: 'pending', consumed: [{ itemId: 'i1', qty: 1, reportedExpiry: '2026-11-30' }] }],
    reportId: 'r1', seal: 'NEW-1', note: 'ok', actor: ACTOR, stamp: STAMP,
  }, overrides);
}

test('the deduction and the replacement are applied to the batches', () => {
  const result = core.closeCrashCartReport(fixture({
    rows: [{ itemId: 'i1', removeQty: 1, sourceExpiry: '2026-11-30', qty: 1, expiry: '2027-06-30' }],
  }));
  const item = result.cart.items.find((row) => row.id === 'i1');
  assert.deepEqual(item.batches.map((b) => [b.expiry, b.qty]), [['2026-11-30', 1], ['2027-06-30', 1]]);
  // The count follows the batches, so the screen and the batches cannot drift.
  assert.equal(item.present, 2);
  assert.equal(item.stockStatus, 'available');
  assert.equal(result.report.status, 'closed');
  assert.equal(result.cart.seal, 'NEW-1');
});

test('a deduction larger than the batch holds is refused', () => {
  /* The browser could send any number; nothing on the server checked it. */
  assert.throws(() => core.closeCrashCartReport(fixture({
    rows: [{ itemId: 'i1', removeQty: 5, sourceExpiry: '2026-11-30', qty: 5, expiry: '2027-06-30' }],
  })), /holds 2, which is less than the 5/);
});

test('a result above the cart standard is refused', () => {
  assert.throws(() => core.closeCrashCartReport(fixture({
    rows: [{ itemId: 'i1', removeQty: 0, sourceExpiry: '', qty: 3, expiry: '2027-06-30' }],
  })), /above the cart standard/);
});

test('a replacement without a date is refused, and an unavailable item needs neither', () => {
  assert.throws(() => core.closeCrashCartReport(fixture({
    rows: [{ itemId: 'i1', removeQty: 1, sourceExpiry: '2026-11-30', qty: 1, expiry: '' }],
  })), /needs an expiry date/);

  const result = core.closeCrashCartReport(fixture({
    rows: [{ itemId: 'i1', unavailable: true, removeQty: 1, sourceExpiry: '2026-11-30' }],
  }));
  const item = result.cart.items.find((row) => row.id === 'i1');
  assert.equal(item.present, 2, 'nothing was removed or added');
  assert.equal(result.replacements[0].unavailable, true);
  assert.equal(result.replacements[0].qty, 0);
});

test('a deduction needs a batch to come off', () => {
  assert.throws(() => core.closeCrashCartReport(fixture({
    rows: [{ itemId: 'i1', removeQty: 1, sourceExpiry: '', qty: 1, expiry: '2027-06-30' }],
  })), /choose the batch this quantity is deducted from/);
});

test('quantities already deducted at report time are not deducted twice', () => {
  /* When the report deducted at submission, the cart already shows the lower
     figure — so closing must add the replacement and take nothing further. */
  const base = fixture({ rows: [{ itemId: 'i1', removeQty: 1, sourceExpiry: '2026-11-30', qty: 1, expiry: '2027-06-30' }] });
  base.reports[0].inventoryDeductedAtReport = true;
  base.carts[0].items[0].batches = [{ expiry: '2026-11-30', qty: 1 }];
  base.carts[0].items[0].present = 1;
  const result = core.closeCrashCartReport(base);
  const item = result.cart.items.find((row) => row.id === 'i1');
  assert.deepEqual(item.batches.map((b) => [b.expiry, b.qty]), [['2026-11-30', 1], ['2027-06-30', 1]]);
  assert.equal(item.present, 2);
  assert.equal(result.replacements[0].reportedQty, 0, 'nothing was taken a second time');
});

test('a report that was already answered cannot be answered again', () => {
  const base = fixture({ rows: [] });
  base.reports[0].status = 'closed';
  assert.throws(() => core.closeCrashCartReport(base), /already been answered/);
});

test('closing needs a new seal, and an unknown report or cart is refused', () => {
  assert.throws(() => core.closeCrashCartReport(fixture({ rows: [], seal: '  ' })), /new seal number is required/);
  assert.throws(() => core.closeCrashCartReport(fixture({ rows: [], reportId: 'nope' })), /no longer exists/);
  const orphan = fixture({ rows: [] });
  orphan.carts = [];
  assert.throws(() => core.closeCrashCartReport(orphan), /Crash Cart for this report no longer exists/);
});

test('nothing is mutated in place: a refused close leaves the inputs untouched', () => {
  /* The browser's version mutated its own copy and then wrote it, which is why a
     failed second write needed a hand-written rollback. */
  const input = fixture({ rows: [{ itemId: 'i1', removeQty: 9, sourceExpiry: '2026-11-30', qty: 1, expiry: '2027-06-30' }] });
  const before = JSON.stringify(input.carts);
  assert.throws(() => core.closeCrashCartReport(input));
  assert.equal(JSON.stringify(input.carts), before);
});
