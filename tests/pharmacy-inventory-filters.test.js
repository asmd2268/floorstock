import assert from 'node:assert/strict';
import { test } from 'node:test';

import { visibleMedicines, filterMedicines, medicinesNeedingReorder } from '../public/assets/js/core/pharmacy-inventory-filters.js';

/* Who sees which medicines, and which ones need reordering. */

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString();
const med = (over = {}) => ({
  name: 'Paracetamol 500mg', mohCode: 'M-1', nupcoCode: 'N-1',
  locations: [{ roomId: 'r1', cabId: 'c1', shelfId: 's1' }], expiry: inDays(400), ...over,
});

test('an empty room assignment means unrestricted, never "sees nothing"', () => {
  /* The one way this could go badly wrong: a pharmacist with no room
     assignment must see the whole pharmacy, not an empty screen. */
  const all = [med(), med({ name: 'Zinc', locations: [{ roomId: 'r9', cabId: 'c1', shelfId: 's1' }] })];
  assert.equal(visibleMedicines(all, []).length, 2);
  assert.equal(visibleMedicines(all, null).length, 2);
});

test('an assigned member sees only what is stored in their rooms', () => {
  const all = [med(), med({ name: 'Zinc', locations: [{ roomId: 'r9', cabId: 'c1', shelfId: 's1' }] })];
  assert.deepEqual(visibleMedicines(all, ['r1']).map((m) => m.name), ['Paracetamol 500mg']);
  // A medicine stored in two rooms, one of them theirs, is theirs to see.
  const both = med({ name: 'Both', locations: [{ roomId: 'r9' }, { roomId: 'r1' }] });
  assert.equal(visibleMedicines([both], ['r1']).length, 1);
  // A medicine with no location recorded belongs to no room they were given.
  assert.equal(visibleMedicines([med({ locations: [] })], ['r1']).length, 0);
});

test('search covers whichever code is printed on the box in front of you', () => {
  const all = [med(), med({ name: 'Zinc', mohCode: 'M-2', nupcoCode: 'N-2' })];
  assert.deepEqual(filterMedicines(all, { search: 'paracet' }).map((m) => m.name), ['Paracetamol 500mg']);
  assert.deepEqual(filterMedicines(all, { search: 'n-2' }).map((m) => m.name), ['Zinc']);
  assert.deepEqual(filterMedicines(all, { search: 'M-1' }).map((m) => m.name), ['Paracetamol 500mg']);
  assert.equal(filterMedicines(all, { search: 'nothing here' }).length, 0);
});

test('a location filter matches the exact shelf, not the room', () => {
  const all = [med(), med({ name: 'Zinc', locations: [{ roomId: 'r1', cabId: 'c1', shelfId: 's2' }] })];
  assert.deepEqual(filterMedicines(all, { location: 'r1:c1:s1' }).map((m) => m.name), ['Paracetamol 500mg']);
});

test('filters combine — every one that is set has to match', () => {
  const all = [
    med({ name: 'A', classification: 'ha', expiry: inDays(10) }),
    med({ name: 'B', classification: 'ha', expiry: inDays(400) }),
    med({ name: 'C', classification: 'lasa', expiry: inDays(10) }),
  ];
  assert.deepEqual(filterMedicines(all, { classification: 'ha', expiry: 'soon' }).map((m) => m.name), ['A']);
  assert.equal(filterMedicines(all, {}).length, 3, 'no filter set shows everything');
});

test('the expiry filter reads the same rule the badges do', () => {
  const all = [med({ name: 'gone', expiry: inDays(-1) }), med({ name: 'soon', expiry: inDays(5) }), med({ name: 'fine' })];
  assert.deepEqual(filterMedicines(all, { expiry: 'expired' }).map((m) => m.name), ['gone']);
  assert.deepEqual(filterMedicines(all, { expiry: 'soon' }).map((m) => m.name), ['soon']);
  assert.deepEqual(filterMedicines(all, { expiry: 'ok' }).map((m) => m.name), ['fine']);
});

test('"stored in more than one place" means more than one, not more than none', () => {
  const all = [med({ name: 'one' }), med({ name: 'two', locations: [{ roomId: 'r1' }, { roomId: 'r2' }] }), med({ name: 'none', locations: [] })];
  assert.deepEqual(filterMedicines(all, { multiLocation: true }).map((m) => m.name), ['two']);
});

test('the reorder list is what is out of stock or running out of time', () => {
  const all = [
    med({ name: 'empty', outOfStock: true }),
    med({ name: 'expired', expiry: inDays(-2) }),
    med({ name: 'soon', expiry: inDays(30) }),
    med({ name: 'fine' }),
    med({ name: 'undated', expiry: '' }),
  ];
  assert.deepEqual(medicinesNeedingReorder(all).map((m) => m.name), ['empty', 'expired', 'soon']);
  // Expired stock stays on the list: it is exactly what has to be replaced.
  assert.equal(medicinesNeedingReorder(all).some((m) => m.name === 'expired'), true);
  // A medicine with no expiry recorded is not claimed to need reordering.
  assert.equal(medicinesNeedingReorder(all).some((m) => m.name === 'undated'), false);
});

test('nothing in, nothing out', () => {
  assert.deepEqual(filterMedicines(null, { search: 'x' }), []);
  assert.deepEqual(medicinesNeedingReorder(null), []);
  assert.deepEqual(visibleMedicines(null, ['r1']), []);
});
