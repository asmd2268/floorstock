import assert from 'node:assert/strict';
import { test } from 'node:test';

import { crashCartStats, isSealCorrection } from '../public/assets/js/core/analytics-crash-carts.js';

/* Fourth slice out of modules/73: the crash-cart analytics. A supervisor reads
   these figures to decide whether a cart is being disturbed too often, so the
   two that must not drift are the opening count and the sealed interval. */

const name = (id) => `Dept ${id}`;
const carts = [
  { id: 'c1', name: 'ICU cart', deptId: 'icu' },
  { id: 'c2', name: 'ER cart', deptId: 'er' },
];
const opening = (over = {}) => ({
  cartId: 'c1', deptId: 'icu', openedAt: '2026-03-01T08:00:00Z', reason: 'Cardiac arrest', replacements: [], ...over,
});

test('a seal correction is not an opening', () => {
  /* The Master fixing a mistyped seal writes a record shaped like every other
     crash-cart record. Counting it inflates the cart's opening count and
     shortens its sealed interval — the two figures the report exists for. */
  assert.equal(isSealCorrection({ operation: 'seal_correction' }), true);
  assert.equal(isSealCorrection({ operation: 'open' }), false);
  assert.equal(isSealCorrection({}), false, 'a record with no operation is an opening');

  const stats = crashCartStats([
    opening(),
    opening({ operation: 'seal_correction', openedAt: '2026-03-02T08:00:00Z' }),
  ], carts, 2026, 2026, name);
  assert.equal(stats.totalOpenings, 1);
  assert.equal(stats.cartsSorted[0].openings, 1);
  assert.equal(stats.cartsSorted[0].intervalDays, null, 'one real opening leaves no interval to measure');
});

test('a year is the hospital\'s year, in its own time zone', () => {
  /* Stored as UTC, read in local time on purpose: a cart opened at 02:00 in
     Riyadh on the 1st of January belongs to the new year on the ward, even
     though UTC still says the 31st of December. */
  const local = (year, month, day, hour) => new Date(year, month - 1, day, hour).toISOString();
  const stats = crashCartStats([
    opening({ openedAt: local(2025, 12, 31, 23) }),
    opening({ openedAt: local(2026, 1, 1, 2) }),
    opening({ openedAt: local(2026, 12, 31, 23) }),
    opening({ openedAt: local(2027, 1, 1, 2) }),
  ], carts, 2026, 2026, name);
  assert.equal(stats.totalOpenings, 2);
});

test('the sealed interval is the average gap between openings, in days', () => {
  const stats = crashCartStats([
    opening({ openedAt: '2026-03-01T00:00:00Z' }),
    opening({ openedAt: '2026-03-11T00:00:00Z' }),
    opening({ openedAt: '2026-03-31T00:00:00Z' }),
  ], carts, 2026, 2026, name);
  assert.equal(stats.cartsSorted[0].intervalDays, 15, '10 days and 20 days');
});

test('a cart opened once has an unknown interval, not a zero', () => {
  const stats = crashCartStats([opening()], carts, 2026, 2026, name);
  assert.equal(stats.cartsSorted[0].intervalDays, null);
});

test('a cart never opened is left out of the ranking entirely', () => {
  const stats = crashCartStats([opening({ cartId: 'c1' })], carts, 2026, 2026, name);
  assert.deepEqual(stats.cartsSorted.map((c) => c.id), ['c1']);
});

test('carts rank by openings, and the least-opened pair is reported least-first', () => {
  const reports = [
    ...Array.from({ length: 3 }, (u, i) => opening({ cartId: 'c1', openedAt: `2026-03-0${i + 1}T08:00:00Z` })),
    opening({ cartId: 'c2', deptId: 'er' }),
  ];
  const stats = crashCartStats(reports, carts, 2026, 2026, name);
  assert.deepEqual(stats.top5.map((c) => c.id), ['c1', 'c2']);
  assert.deepEqual(stats.bottom2.map((c) => c.id), ['c2', 'c1']);
  assert.equal(stats.top5[0].dept, 'Dept icu');
});

test('replacements are counted per medicine and per department', () => {
  const stats = crashCartStats([
    opening({ replacements: [{ name: 'Adrenaline' }, { name: 'Atropine' }] }),
    opening({ cartId: 'c2', deptId: 'er', replacements: [{ medName: 'Adrenaline' }] }),
  ], carts, 2026, 2026, name);
  assert.equal(stats.totalReplacements, 3);
  assert.equal(stats.avgReplacementsPerOpening, 1.5);
  assert.deepEqual(stats.topMeds[0], { name: 'Adrenaline', count: 2 });
  assert.deepEqual(stats.deptMedCounts.Adrenaline, { 'Dept icu': 1, 'Dept er': 1 });
});

test('a medicine is named by whichever field the record happens to carry', () => {
  const stats = crashCartStats([
    opening({ replacements: [{ genericName: 'Amiodarone' }, { medId: 'm-77' }, {}] }),
  ], carts, 2026, 2026, name);
  assert.deepEqual(stats.topMeds.map((m) => m.name).sort(), ['Amiodarone', 'm-77', '—']);
});

test('"opened and nothing used" is its own reason, not a blank', () => {
  const stats = crashCartStats([
    opening({ noConsumption: true, reason: '' }),
    opening({ reason: '' }),
  ], carts, 2026, 2026, name);
  const reasons = Object.fromEntries(stats.reasonBreakdown.map((r) => [r.reason, r.count]));
  assert.equal(reasons['No medications consumed / فحص روتيني بدون استهلاك'], 1);
  assert.equal(reasons['—'], 1, 'no reason recorded is a different fact');
});

test('a very long reason is shortened rather than breaking the table', () => {
  const stats = crashCartStats([opening({ reason: 'x'.repeat(200) })], carts, 2026, 2026, name);
  assert.equal(stats.reasonBreakdown[0].reason.length, 91);
  assert.match(stats.reasonBreakdown[0].reason, /…$/);
});

test('no reports at all divides nothing by zero', () => {
  const stats = crashCartStats([], carts, 2026, 2026, name);
  assert.deepEqual(
    { openings: stats.totalOpenings, avg: stats.avgReplacementsPerOpening, top: stats.top5, reasons: stats.reasonBreakdown },
    { openings: 0, avg: 0, top: [], reasons: [] },
  );
  assert.deepEqual(crashCartStats(null, null, 2026, 2026, name).cartsSorted, []);
});
