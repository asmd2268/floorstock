import assert from 'node:assert/strict';
import { test } from 'node:test';

import { controlledStatusKey, controlledStatus, earliestDays, daysUntil } from '../public/assets/js/core/controlled-stock-status.js';

/* What a controlled medicine's row says. The ORDER of these checks is the rule:
   expiry outranks quantity, and an empty shelf outranks a thin one, because
   that is the order a pharmacist has to act in. */

const TODAY = new Date(2026, 2, 1);
/* Written as the hospital writes them: local calendar days, not UTC instants. */
const inDays = (days) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const status = (med, warehouse, pharmacy, alertDays = 60) =>
  controlledStatusKey(med, warehouse, pharmacy, alertDays, TODAY);

const stocked = { system: 100, outside: 0, batches: [{ expiry: inDays(400) }] };
const onShelf = { qty: 50, batches: [{ expiry: inDays(400) }] };

test('a medicine in date and in stock is fine', () => {
  assert.equal(status({ min: 10 }, stocked, onShelf), 'ok');
  assert.match(controlledStatus({ min: 10 }, stocked, onShelf, 60, TODAY).html, /OK/);
});

test('something expiring today is expired, whatever hour the page was opened', () => {
  assert.equal(daysUntil(inDays(0), TODAY), 0);
  assert.equal(status({}, { ...stocked, batches: [{ expiry: inDays(0) }] }, onShelf), 'expired');
  assert.equal(status({}, { ...stocked, batches: [{ expiry: inDays(-1) }] }, onShelf), 'expired');
});

test('expiry outranks quantity — expired stock must be pulled whatever the count says', () => {
  const empty = { qty: 0, batches: [] };
  assert.equal(status({ min: 10 }, { ...stocked, batches: [{ expiry: inDays(-5) }] }, empty), 'expired');
});

test('the worst of warehouse and pharmacy decides', () => {
  /* In date in the warehouse, expiring on the pharmacy shelf: expiring. */
  assert.equal(status({}, stocked, { ...onShelf, batches: [{ expiry: inDays(10) }] }), 'soon');
  assert.equal(status({}, { ...stocked, batches: [{ expiry: inDays(10) }] }, onShelf), 'soon');
});

test('the alert window is the hospital\'s own, not a fixed sixty days', () => {
  const soonish = { ...onShelf, batches: [{ expiry: inDays(45) }] };
  assert.equal(status({}, stocked, soonish, 60), 'soon');
  assert.equal(status({}, stocked, soonish, 30), 'ok', 'a shorter window leaves it alone');
});

test('an empty shelf is out of stock, and it outranks being below minimum', () => {
  assert.equal(status({ min: 10 }, stocked, { qty: 0, batches: [] }), 'out');
  assert.equal(status({ min: 10 }, { system: 0, outside: 0, batches: [] }, onShelf), 'out',
    'empty in the warehouse counts too');
});

test('stock held outside the system still counts as stock', () => {
  assert.equal(status({ min: 10 }, { system: 0, outside: 40, batches: [] }, onShelf), 'ok');
});

test('below minimum is reported on either side', () => {
  assert.equal(status({ min: 60 }, stocked, onShelf), 'low', '50 on the shelf against a minimum of 60');
  assert.equal(status({ min: 200 }, stocked, onShelf), 'low', '100 in the warehouse against 200');
  assert.equal(status({ min: 0 }, stocked, onShelf), 'ok', 'no minimum set means nothing to be below');
});

test('a batch with no readable date is unknown, not urgent', () => {
  assert.equal(earliestDays([{ expiry: '' }, { expiry: 'nonsense' }], TODAY), null);
  assert.equal(status({}, { system: 5, outside: 0, batches: [{ expiry: '' }] }, onShelf), 'ok');
  // But a dated batch alongside it still counts.
  assert.equal(earliestDays([{ expiry: '' }, { expiry: inDays(5) }], TODAY), 5);
});

test('the nearest expiry decides, not the first one listed', () => {
  assert.equal(earliestDays([{ expiry: inDays(90) }, { expiry: inDays(3) }, { expiry: inDays(40) }], TODAY), 3);
  assert.equal(earliestDays([], TODAY), null);
  assert.equal(earliestDays(null, TODAY), null);
});

test('a quantity typed with a separator still counts', () => {
  assert.equal(status({ min: 10 }, { system: '1,500', outside: 0, batches: [] }, onShelf), 'ok');
});

test('a date is compared as a calendar day, in the hospital\'s own time zone', () => {
  assert.equal(daysUntil('2026-03-02', TODAY), 1);
  assert.equal(daysUntil('2026-02-28', TODAY), -1);
  assert.equal(daysUntil('', TODAY), null);
  assert.equal(daysUntil('not a date', TODAY), null);
});
