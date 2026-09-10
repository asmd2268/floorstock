import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  rowsInRange, monthsInRange, medicineQty, medicineNamesFrom,
  drugComparisonStats, deptDrugTrendStats,
} from '../public/assets/js/core/analytics-drug-trends.js';

/* Third slice out of modules/73: one medicine's dispensing over a period,
   across departments or inside one. The two reports were written twice, month
   walk and all. These tests pin the parts that were easy to get wrong. */

const row = (over = {}) => ({
  deptId: 'icu',
  fulfilledAt: '2026-03-10T08:00:00Z',
  dispensed: [{ name: 'Paracetamol 500mg', qty: 5 }],
  ...over,
});

test('both end months are included — March to March means March', () => {
  assert.deepEqual(monthsInRange(2026, 3, 2026, 3).map((m) => m.month), [3]);
  assert.deepEqual(monthsInRange(2026, 1, 2026, 3).map((m) => m.month), [1, 2, 3]);
});

test('a range that crosses the new year rolls over instead of running forever', () => {
  const months = monthsInRange(2025, 11, 2026, 2);
  assert.deepEqual(months.map((m) => `${m.year}-${m.month}`), ['2025-11', '2025-12', '2026-1', '2026-2']);
  assert.equal(months[0].label, 'November');
});

test('a backwards range yields no months rather than looping', () => {
  assert.deepEqual(monthsInRange(2026, 5, 2026, 3), []);
});

test('the period runs to the END of the closing month, not its first day', () => {
  const rows = [
    row({ fulfilledAt: '2026-02-28T23:00:00Z' }),
    row({ fulfilledAt: '2026-03-01T00:30:00Z' }),
    row({ fulfilledAt: '2026-03-31T23:00:00Z' }),
    row({ fulfilledAt: '2026-04-01T09:00:00Z' }),
  ];
  const inRange = rowsInRange(rows, 2026, 3, 2026, 3);
  assert.equal(inRange.length, 2, 'the whole of March, and only March');
});

test('a row is dated by when it was fulfilled, falling back to when it was raised', () => {
  const rows = [
    row({ fulfilledAt: '', updatedAt: '2026-03-10T08:00:00Z' }),
    row({ fulfilledAt: '', updatedAt: '', created: '2026-03-11T08:00:00Z' }),
    row({ fulfilledAt: '', updatedAt: '', created: '' }),
  ];
  assert.equal(rowsInRange(rows, 2026, 3, 2026, 3).length, 2);
});

test('a medicine nobody dispensed reports zero, with no departments', () => {
  const found = medicineQty([row()], 'Nothing At All');
  assert.deepEqual(found, { qty: 0, depts: {} });
});

test('the comparison ranks departments by quantity, busiest first', () => {
  const rows = [
    row({ deptId: 'icu', dispensed: [{ name: 'Paracetamol 500mg', qty: 5 }] }),
    row({ deptId: 'er', dispensed: [{ name: 'Paracetamol 500mg', qty: 12 }] }),
    row({ deptId: 'icu', dispensed: [{ name: 'Paracetamol 500mg', qty: 3 }] }),
  ];
  const stats = drugComparisonStats(rows, 'Paracetamol 500mg', 2026, 3, 2026, 3);
  assert.equal(stats.totalQty, 20);
  assert.deepEqual(stats.deptRows.map((d) => d.qty), [12, 8]);
  assert.equal(stats.months.length, 1);
  assert.equal(stats.months[0].qty, 20);
});

test('a month with nothing dispensed is reported as zero, not skipped', () => {
  /* A gap in the chart has to be visible: a month missing from the list would
     silently redraw the trend as if the period were shorter. */
  const rows = [row({ fulfilledAt: '2026-01-10T08:00:00Z' }), row({ fulfilledAt: '2026-03-10T08:00:00Z' })];
  const stats = drugComparisonStats(rows, 'Paracetamol 500mg', 2026, 1, 2026, 3);
  assert.deepEqual(stats.months.map((m) => m.qty), [5, 0, 5]);
});

test('a department trend counts only that department', () => {
  const rows = [
    row({ deptId: 'icu', dispensed: [{ name: 'Paracetamol 500mg', qty: 4 }] }),
    row({ deptId: 'er', dispensed: [{ name: 'Paracetamol 500mg', qty: 40 }] }),
  ];
  const stats = deptDrugTrendStats(rows, 'icu', 'Paracetamol 500mg', 2026, 3, 2026, 3);
  assert.equal(stats.totalQty, 4);
  assert.equal(stats.activeMonths, 1);
});

test('the busiest month is named, and a medicine nobody used has none', () => {
  const rows = [
    row({ fulfilledAt: '2026-01-05T08:00:00Z', dispensed: [{ name: 'Paracetamol 500mg', qty: 2 }] }),
    row({ fulfilledAt: '2026-02-05T08:00:00Z', dispensed: [{ name: 'Paracetamol 500mg', qty: 9 }] }),
  ];
  const busy = deptDrugTrendStats(rows, 'icu', 'Paracetamol 500mg', 2026, 1, 2026, 2);
  assert.equal(busy.peak.month, 2);
  assert.equal(busy.peak.qty, 9);
  assert.equal(busy.avgPerMonth, 5.5);

  const none = deptDrugTrendStats(rows, 'icu', 'Never Dispensed', 2026, 1, 2026, 2);
  assert.equal(none.peak, null, 'a peak of zero is not a peak');
  assert.equal(none.activeMonths, 0);
  assert.equal(none.avgPerMonth, 0);
});

test('the medicine picker lists each medicine once, sorted', () => {
  const rows = [
    row({ dispensed: [{ name: 'Zinc', qty: 1 }] }),
    row({ dispensed: [{ name: 'Amoxicillin', qty: 1 }] }),
    row({ dispensed: [{ name: 'Zinc', qty: 2 }] }),
  ];
  const names = medicineNamesFrom(rows);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names.slice().sort((a, b) => a.localeCompare(b)), names);
});

test('nothing in, nothing out', () => {
  assert.deepEqual(rowsInRange(null, 2026, 1, 2026, 12), []);
  const stats = drugComparisonStats([], 'Anything', 2026, 1, 2026, 1);
  assert.equal(stats.totalQty, 0);
  assert.deepEqual(stats.deptRows, []);
});
