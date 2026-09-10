import assert from 'node:assert/strict';
import { test } from 'node:test';

import { narcoticStats } from '../public/assets/js/core/analytics-narcotics.js';

/* Fifth slice out of modules/73: the controlled-medicine year. These numbers go
   into a report the pharmacy answers for, so what is counted — and what is not —
   is the whole substance of it. */

const at = (year, month, day = 1, hour = 9) => new Date(year, month - 1, day, hour).toISOString();
const move = (over = {}) => ({ type: 'dispense', at: at(2026, 3), medId: 'm1', qty: 2, ...over });
const catalog = [
  { id: 'm1', name: 'Morphine 10mg', classification: 'narcotic' },
  { id: 'm2', name: 'Midazolam 5mg', classification: 'psychotropic' },
];

test('only dispensing counts — receipts and transfers are not consumption', () => {
  const stats = narcoticStats([
    move(),
    move({ type: 'receive', qty: 100 }),
    move({ type: 'transfer', qty: 50 }),
    move({ type: 'correction', qty: 7 }),
  ], catalog, 2026);
  assert.equal(stats.moves, 1);
  assert.equal(stats.totalUnits, 2, 'a year of careful stock-keeping must not read as heavy use');
});

test('only that year counts, in the hospital\'s own time zone', () => {
  const stats = narcoticStats([
    move({ at: at(2025, 12, 31, 23) }),
    move({ at: at(2026, 1, 1, 2) }),
    move({ at: at(2027, 1, 1) }),
  ], catalog, 2026);
  assert.equal(stats.moves, 1);
});

test('a movement with no destination recorded still counts as stock that left', () => {
  /* Inpatient and outpatient are not two independent tallies: outpatient is
     everything else. Dropping untagged movements would understate the year. */
  const stats = narcoticStats([
    move({ dispenseType: 'inpatient', qty: 5 }),
    move({ dispenseType: 'internal', qty: 3 }),
    move({ dispenseType: 'outpatient', qty: 4 }),
    move({ qty: 6 }),
  ], catalog, 2026);
  assert.equal(stats.totalUnits, 18);
  assert.equal(stats.inpatientUnits, 8, 'inpatient and internal both mean a ward');
  assert.equal(stats.outpatientUnits, 10, 'the untagged 6 units are still counted');
});

test('months and quarters agree with each other and with the total', () => {
  const stats = narcoticStats([
    move({ at: at(2026, 1), qty: 1 }),
    move({ at: at(2026, 3), qty: 2 }),
    move({ at: at(2026, 4), qty: 4 }),
    move({ at: at(2026, 12), qty: 8 }),
  ], catalog, 2026);
  assert.equal(stats.monthly.length, 12, 'every month is present, including the empty ones');
  assert.equal(stats.monthly[0].units, 1);
  assert.equal(stats.monthly[1].units, 0);
  assert.equal(stats.monthly[11].units, 8);
  assert.deepEqual(stats.quarterly.map((q) => q.units), [3, 4, 0, 8]);
  assert.equal(stats.quarterly.reduce((sum, q) => sum + q.units, 0), stats.totalUnits);
  assert.equal(stats.monthly.reduce((sum, m) => sum + m.events, 0), stats.moves);
});

test('medicines are ranked by units, with their classification', () => {
  const stats = narcoticStats([
    move({ medId: 'm1', qty: 3 }),
    move({ medId: 'm2', qty: 10 }),
    move({ medId: 'm1', qty: 4 }),
  ], catalog, 2026);
  assert.deepEqual(stats.topMeds.map((m) => m.name), ['Midazolam 5mg', 'Morphine 10mg']);
  assert.deepEqual(stats.topMeds[1], { name: 'Morphine 10mg', units: 7, events: 2, cls: 'narcotic' });
  assert.equal(stats.topMeds[0].cls, 'psychotropic');
  assert.equal(stats.uniqueMeds, 2);
});

test('a medicine the catalog no longer lists is still reported, under its id', () => {
  const stats = narcoticStats([move({ medId: 'deleted-med', qty: 5 })], catalog, 2026);
  assert.deepEqual(stats.topMeds[0], { name: 'deleted-med', units: 5, events: 1, cls: 'narcotic' });
});

test('a movement with no medicine still counts in the total, but names nothing', () => {
  const stats = narcoticStats([move({ medId: '', qty: 9 })], catalog, 2026);
  assert.equal(stats.totalUnits, 9);
  assert.equal(stats.uniqueMeds, 0);
  assert.deepEqual(stats.topMeds, []);
});

test('at most ten medicines are listed, the ten largest', () => {
  const moves = Array.from({ length: 14 }, (unused, i) => move({ medId: `m${i}`, qty: i + 1 }));
  const stats = narcoticStats(moves, [], 2026);
  assert.equal(stats.topMeds.length, 10);
  assert.equal(stats.topMeds[0].units, 14);
  assert.equal(stats.topMeds[9].units, 5);
});

test('a quantity that is missing or nonsense counts as none, never as NaN', () => {
  const stats = narcoticStats([move({ qty: undefined }), move({ qty: 'x' }), move({ qty: 3 })], catalog, 2026);
  assert.equal(stats.totalUnits, 3);
  assert.equal(stats.moves, 3, 'the movement still happened, even with no quantity recorded');
});

test('an empty ledger reports a clean zero year', () => {
  const stats = narcoticStats([], catalog, 2026);
  assert.equal(stats.totalUnits, 0);
  assert.equal(stats.moves, 0);
  assert.equal(stats.monthly.length, 12);
  assert.deepEqual(stats.topMeds, []);
  assert.deepEqual(narcoticStats(null, null, 2026).catalog, []);
});
