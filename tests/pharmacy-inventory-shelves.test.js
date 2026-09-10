import assert from 'node:assert/strict';
import test from 'node:test';

import {
  piShelfCmp, piShelvesOf, piParseShelfLine, piShelfLine, piShelfCells,
  piCellLabel, piFindShelf, piCellOptionsHtml,
  piDaysToExpiry, piExpiryStatus, piExpiryLabel, PI_EXPIRY_WARN_DAYS,
} from '../public/assets/js/core/pharmacy-inventory-model.js';

/* The pharmacy inventory's model: where a medicine sits, and how close it is to
   expiring. This test used to `eval` these functions out of the shipped module
   source because there was no other way to reach them; they are a module now. */

test('shelves sort A→Z and by number, not by raw string order', () => {
  assert.deepEqual(['E', 'D', 'C', 'B', 'A'].sort(piShelfCmp), ['A', 'B', 'C', 'D', 'E']);
  // Plain string order puts "Shelf 10" before "Shelf 2", which reads as a bug.
  assert.deepEqual(['Shelf 10', 'Shelf 2', 'Shelf 1'].sort(piShelfCmp), ['Shelf 1', 'Shelf 2', 'Shelf 10']);
  assert.deepEqual(['b', 'A', 'c'].sort(piShelfCmp), ['A', 'b', 'c']);
});

test('a hand-arranged cabinet keeps its order; older cabinets fall back to name order', () => {
  const ordered = { shelves: [{ name: 'C', order: 0 }, { name: 'A', order: 1 }, { name: 'B', order: 2 }] };
  assert.deepEqual(piShelvesOf(ordered).map((s) => s.name), ['C', 'A', 'B']);
  const legacy = { shelves: [{ name: 'C' }, { name: 'A' }, { name: 'B' }] };
  assert.deepEqual(piShelvesOf(legacy).map((s) => s.name), ['A', 'B', 'C']);
  assert.deepEqual(piShelvesOf(null), []);
});

test('a shelf line is one line of typing, with an optional cell count', () => {
  assert.deepEqual(piParseShelfLine('A x 4'), { name: 'A', cells: 4 });
  assert.deepEqual(piParseShelfLine('Shelf B*6'), { name: 'Shelf B', cells: 6 });
  assert.deepEqual(piParseShelfLine('C × 3'), { name: 'C', cells: 3 }, 'the Arabic keyboard\'s multiplication sign works too');
  assert.deepEqual(piParseShelfLine('D'), { name: 'D', cells: 1 }, 'a shelf with no count is one row');
  assert.deepEqual(piParseShelfLine('  E  '), { name: 'E', cells: 1 });
});

test('a nonsense cell count cannot produce a cabinet nobody can print', () => {
  assert.equal(piParseShelfLine('A x 0').cells, 1);
  assert.equal(piParseShelfLine('A x 99').cells, 40, 'capped, not taken literally');
  assert.equal(piShelfCells({ cells: 'x' }), 1);
  assert.equal(piShelfCells(null), 1);
});

test('what was typed comes back the same when the shelf is edited again', () => {
  for (const line of ['A x 4', 'B', 'Top shelf x 12']) {
    assert.equal(piShelfLine(piParseShelfLine(line)), line.replace(/\s*[x*×]\s*/i, ' x '));
  }
});

test('a row is labelled by its own shelf: shelf A row 2 is "A2"', () => {
  assert.equal(piCellLabel({ name: 'A' }, 1), 'A2');
  assert.equal(piCellLabel({ name: 'Top' }, 0), 'Top1');
  assert.equal(piCellLabel(null, 0), '1');
});

const rooms = [{
  id: 'r1',
  cabinets: [{ id: 'c1', shelves: [{ id: 's1', name: 'A', cells: 3 }] }],
}];

test('a location is only resolved when all three parts exist', () => {
  assert.equal(piFindShelf(rooms, 'r1|c1|s1').shelf.name, 'A');
  assert.equal(piFindShelf(rooms, 'r1|c1'), null);
  assert.equal(piFindShelf(rooms, 'r9|c1|s1'), null);
  assert.equal(piFindShelf(rooms, 'r1|c9|s1'), null);
  assert.equal(piFindShelf(rooms, 'r1|c1|s9'), null);
  assert.equal(piFindShelf(null, ''), null);
});

test('a medicine may sit on a shelf with no row recorded', () => {
  /* Forcing a guess would print it in a place nobody verified, so "—" stays. */
  const html = piCellOptionsHtml(rooms, 'r1|c1|s1', '2');
  assert.match(html, /<option value="">—<\/option>/);
  assert.equal((html.match(/<option/g) || []).length, 4, 'the dash plus three rows');
  assert.match(html, /<option value="2" selected>A2<\/option>/);
  // An unknown shelf offers the dash alone rather than an invented grid.
  assert.equal(piCellOptionsHtml(rooms, 'nope', ''), '<option value="">—</option>');
});

test('a shelf name with markup in it cannot break the picker', () => {
  const nasty = [{ id: 'r1', cabinets: [{ id: 'c1', shelves: [{ id: 's1', name: '<img src=x>', cells: 1 }] }] }];
  assert.doesNotMatch(piCellOptionsHtml(nasty, 'r1|c1|s1', ''), /<img/);
});

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString();

test('a medicine with no expiry recorded is unknown, never reported as fine', () => {
  assert.equal(piDaysToExpiry(''), null);
  assert.equal(piDaysToExpiry('not a date'), null);
  assert.equal(piExpiryLabel(''), '', 'nothing is claimed about it');
});

test('sixty days is the warning line, and past it is expired', () => {
  assert.equal(PI_EXPIRY_WARN_DAYS, 60);
  assert.equal(piExpiryStatus(inDays(400)), 'ok');
  assert.equal(piExpiryStatus(inDays(59)), 'soon');
  assert.equal(piExpiryStatus(inDays(-1)), 'expired');
  assert.match(piExpiryLabel(inDays(-1)), /Expired/);
  assert.match(piExpiryLabel(inDays(10)), /d left/);
  assert.equal(piExpiryLabel(inDays(400)), '', 'a medicine with months left needs no label');
});
