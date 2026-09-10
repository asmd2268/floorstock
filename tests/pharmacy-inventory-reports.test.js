import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  lastMovementByMedicine, inactiveSince, cutoffDaysAgo, periodSummary,
} from '../public/assets/js/core/pharmacy-inventory-reports.js';

/* What has not come in, what has not gone out, and what moved in a period. */

const txn = (over = {}) => ({ type: 'receipt', medName: 'Paracetamol', date: '2026-03-01', qty: 10, ...over });
const catalog = ['Paracetamol', 'Zinc', 'Never Moved'];

test('the last movement in each direction is found, per medicine', () => {
  const rows = [
    txn({ date: '2026-01-01' }),
    txn({ date: '2026-03-01' }),
    txn({ type: 'dispense', date: '2026-05-01' }),
  ];
  assert.deepEqual(lastMovementByMedicine(rows, 'receipt'), { Paracetamol: '2026-03-01' });
  assert.deepEqual(lastMovementByMedicine(rows, 'dispense'), { Paracetamol: '2026-05-01' });
  assert.deepEqual(lastMovementByMedicine(null, 'receipt'), {});
});

test('a medicine that has NEVER been received is exactly what the report wants', () => {
  /* Asked against the whole medicine list, not against the movements: a
     medicine that only appears in the movements can never be missing from them. */
  const found = inactiveSince([txn({ date: '2026-03-01' })], catalog, 'receipt', '2026-02-01');
  assert.deepEqual(found.map((row) => row.medicine), ['Zinc', 'Never Moved']);
  assert.equal(found[0].lastDate, null, 'reported with no date rather than dropped');
});

test('a medicine received before the cutoff is listed with the date it last came', () => {
  const found = inactiveSince([txn({ date: '2025-12-01' })], ['Paracetamol'], 'receipt', '2026-02-01');
  assert.deepEqual(found, [{ medicine: 'Paracetamol', lastDate: '2025-12-01' }]);
});

test('a medicine received on the cutoff day is not overdue', () => {
  assert.deepEqual(inactiveSince([txn({ date: '2026-02-01' })], ['Paracetamol'], 'receipt', '2026-02-01'), []);
});

test('the cutoff is a real number of days back, and never zero days', () => {
  const now = Date.UTC(2026, 2, 31, 12);
  assert.equal(cutoffDaysAgo(30, now), '2026-03-01');
  assert.equal(cutoffDaysAgo(0, now), cutoffDaysAgo(1, now), 'a window of no days would flag everything');
  assert.equal(cutoffDaysAgo('nonsense', now), cutoffDaysAgo(1, now));
});

test('the period summary counts both directions and nets them', () => {
  const rows = [
    txn({ medName: 'Zinc', qty: 100 }),
    txn({ medName: 'Zinc', type: 'dispense', qty: 130 }),
    txn({ medName: 'Paracetamol', qty: 40 }),
  ];
  const { rows: summary, totals } = periodSummary(rows, { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(summary.map((row) => row.medicine), ['Paracetamol', 'Zinc'], 'sorted by name');
  assert.deepEqual(summary[1], { medicine: 'Zinc', received: 100, dispensed: 130, net: -30 });
  assert.deepEqual(totals, { received: 140, dispensed: 130, net: 10 });
});

test('both end dates are inside the period', () => {
  /* A report "from the 1st to the 31st" that quietly excluded the 31st would
     under-count every month-end. */
  const rows = [
    txn({ date: '2026-02-28' }), txn({ date: '2026-03-01' }),
    txn({ date: '2026-03-31' }), txn({ date: '2026-04-01' }),
  ];
  assert.equal(periodSummary(rows, { from: '2026-03-01', to: '2026-03-31' }).totals.received, 20);
});

test('the medicine filter matches part of a name, case-insensitively', () => {
  const rows = [txn({ medName: 'Paracetamol 500mg' }), txn({ medName: 'Zinc' })];
  assert.equal(periodSummary(rows, { medicine: 'PARACET' }).rows.length, 1);
  assert.equal(periodSummary(rows, { medicine: '' }).rows.length, 2);
});

test('an empty period reports nothing rather than a row of zeros', () => {
  const { rows, totals } = periodSummary([txn({ date: '2020-01-01' })], { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(rows, []);
  assert.deepEqual(totals, { received: 0, dispensed: 0, net: 0 });
  assert.deepEqual(periodSummary(null, {}).rows, []);
});

test('a movement with no medicine name is not counted as a nameless row', () => {
  const { rows } = periodSummary([txn({ medName: '   ' }), txn()], {});
  assert.deepEqual(rows.map((row) => row.medicine), ['Paracetamol']);
});

test('a quantity that is missing or nonsense counts as none', () => {
  const { totals } = periodSummary([txn({ qty: undefined }), txn({ qty: 'x' }), txn({ qty: 5 })], {});
  assert.equal(totals.received, 5);
});
