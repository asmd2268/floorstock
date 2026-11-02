import assert from 'node:assert/strict';
import { test } from 'node:test';
import { batchInWindow, itemInWindow, windowDays } from '../public/assets/js/core/crash-cart-expiry-window.js';

const today = Date.UTC(2026, 10, 2);
const daysUntil = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - today) / 86400000);
const doc = (value) => ({ getElementById: () => (value === undefined ? null : { value }) });

test('expired batches and batches inside the window are in; later ones are out', () => {
  assert.equal(batchInWindow({ expiry: '2026-09-01' }, 60, daysUntil), true);   // expired
  assert.equal(batchInWindow({ expiry: '2026-11-02' }, 60, daysUntil), true);   // today
  assert.equal(batchInWindow({ expiry: '2027-01-01' }, 60, daysUntil), true);   // day 60
  assert.equal(batchInWindow({ expiry: '2027-01-02' }, 60, daysUntil), false);  // day 61
});

test('a batch with no usable date is not in the window', () => {
  assert.equal(batchInWindow({ qty: 2 }, 60, daysUntil), false);
  assert.equal(batchInWindow({ expiry: 'bad' }, 60, () => null), false);
  assert.equal(batchInWindow(null, 60, daysUntil), false);
});

test('an item is in the window when any batch is', () => {
  const item = { batches: [{ expiry: '2030-01-01' }, { expiry: '2026-12-01' }] };
  assert.equal(itemInWindow(item, 60, daysUntil), true);
  assert.equal(itemInWindow(item, 10, daysUntil), false);
  assert.equal(itemInWindow({ batches: [] }, 60, daysUntil), false);
});

test('the window comes from the box, defaults to 60, and rejects non-days', () => {
  assert.equal(windowDays(doc('90')), 90);
  assert.equal(windowDays(doc(undefined)), 60);
  assert.equal(windowDays(doc('')), 60);
  assert.equal(windowDays(doc('0')), 60);
  assert.equal(windowDays(doc('1.5')), 60);
  assert.equal(windowDays(doc('9999')), 60);
});
