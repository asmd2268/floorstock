import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  crashResponseRowIssue, itemPresent, itemStandard, datedBatches, quantityAtExpiry,
} from '../public/assets/js/core/crash-response-validation.js';

/* One line of the pharmacy's answer to a crash-cart report. Every refusal here
   exists because the alternative is a cart whose recorded contents do not match
   what is inside it. */

const item = (over = {}) => ({
  id: 'i1', name: 'Adrenaline', qty: 6, present: 4,
  batches: [{ expiry: '2026-06-01', qty: 3 }, { expiry: '2027-01-01', qty: 1 }],
  ...over,
});
const plan = (over = {}) => ({ itemId: 'i1', reportedQty: 2, removeQty: 2, qty: 2, expiry: '2028-01-01', sourceExpiry: '2026-06-01', unavailable: false, ...over });

const check = (p, it, extra = {}) => crashResponseRowIssue(p, {
  present: itemPresent(it), standard: itemStandard(it),
  datedBatchCount: datedBatches(it).length,
  quantityAtExpiry: quantityAtExpiry(it, p.sourceExpiry),
  ...extra,
});

test('a clean line reports the quantity the cart will hold', () => {
  const outcome = check(plan(), item());
  assert.equal(outcome.error, '');
  assert.equal(outcome.result, 4, '4 present − 2 used + 2 replaced');
});

test('a quantity must be deducted from a named batch when the cart has dated ones', () => {
  /* Deducting from "somewhere" is how a cart's expiry record stops matching. */
  const outcome = check(plan({ sourceExpiry: '' }), item());
  assert.match(outcome.error, /Choose the batch/);
});

test('a cart with no dated batches at all does not demand one', () => {
  const outcome = check(plan({ sourceExpiry: '' }), item({ batches: [] }));
  assert.equal(outcome.error, '');
});

test('the chosen batch must actually hold the reported quantity', () => {
  const outcome = check(plan({ reportedQty: 9, removeQty: 9 }), item());
  assert.match(outcome.error, /no longer has enough quantity/);
});

test('a line with nothing reported still cannot over-draw the batch it names', () => {
  const outcome = check(plan({ reportedQty: 0, removeQty: 5, qty: 0 }), item());
  assert.match(outcome.error, /does not have enough quantity/);
});

test('a replacement quantity needs an expiry, and can never be negative', () => {
  assert.match(check(plan({ qty: 2, expiry: '' }), item()).error, /requires an expiry date/);
  assert.match(check(plan({ qty: -1 }), item()).error, /cannot be negative/);
  assert.equal(check(plan({ qty: 0, expiry: '' }), item()).error, '', 'putting nothing back needs no date');
});

test('a line can never take the item past the cart standard', () => {
  /* The standard is the count the next inspection is checked against. */
  const outcome = check(plan({ reportedQty: 0, removeQty: 0, qty: 3 }), item({ present: 6, qty: 6 }));
  assert.match(outcome.error, /exceeds standard 6/);
  // Below standard is allowed: the pharmacy may not have enough stock today.
  assert.equal(check(plan({ reportedQty: 0, removeQty: 0, qty: 1 }), item({ present: 4, qty: 6 })).error, '');
});

test('a report already deducted at reporting time removes nothing more', () => {
  /* Otherwise the same units come off twice and the cart reads short. */
  const outcome = check(plan({ reportedQty: 2, removeQty: 2, qty: 0 }), item(), { alreadyDeducted: true });
  assert.equal(outcome.error, '');
  assert.equal(outcome.removing, 0);
  assert.equal(outcome.result, 4, 'nothing is taken off a second time');
});

test('a medicine the pharmacy has none of is recorded without any batch demands', () => {
  const outcome = check(plan({ unavailable: true, qty: 0, expiry: '', sourceExpiry: '' }), item());
  assert.equal(outcome.error, '');
});

test('an item marked out of stock with no count holds none, not its standard', () => {
  assert.equal(itemPresent({ qty: 6, stockStatus: 'out_of_stock' }), 0);
  assert.equal(itemPresent({ qty: 6, present: 2, stockStatus: 'out_of_stock' }), 2);
  assert.equal(itemPresent({ qty: 6 }), 6, 'an item with no count recorded is assumed complete');
  assert.equal(itemStandard({ qty: 6 }), 6);
});

test('only batches with both a date and a quantity can be deducted from', () => {
  const mixed = item({ batches: [{ expiry: '2026-06-01', qty: 3 }, { expiry: '', qty: 5 }, { expiry: '2027-01-01', qty: 0 }] });
  assert.equal(datedBatches(mixed).length, 1);
  assert.equal(quantityAtExpiry(mixed, '2026-06-01'), 3);
  assert.equal(quantityAtExpiry(mixed, '2026-06-01T10:00:00Z'), 3, 'a timestamp still names its day');
  assert.equal(quantityAtExpiry(mixed, '2030-01-01'), 0);
});
