import test from 'node:test';
import assert from 'node:assert/strict';
import { storageLocations, otherCells, staleCells } from '../public/assets/js/core/controlled-storage-locations.js';

const data = { units: [
  { id: 'u1', name: 'CABINET1', rows: [{ cells: [{ code: 'A1', medId: 'm1' }, { code: 'A2', medId: 'm2' }] }, { cells: [{ code: 'B1', medId: 'm1' }, { code: 'B2', medId: '' }] }] },
  { id: 'u2', name: 'SAFE', rows: [{ cells: [{ code: 'A1', medId: 'm1' }, { code: 'A2', medId: 'gone' }] }] },
] };

test('a medicine placed in several cells lists every one of them', () => {
  assert.equal(storageLocations(data).m1.length, 3);
  assert.equal(storageLocations(data).m2.length, 1);
});

test('the other cells are named by code in the same unit and by unit and code elsewhere', () => {
  const loc = storageLocations(data);
  assert.deepEqual(otherCells(loc, 'm1', 'u1', 'A1'), ['B1', 'SAFE A1']);
  assert.deepEqual(otherCells(loc, 'm1', 'u2', 'A1'), ['CABINET1 A1', 'CABINET1 B1']);
});

test('a medicine in one cell has no duplicates, and the same code in another unit is not itself', () => {
  assert.deepEqual(otherCells(storageLocations(data), 'm2', 'u1', 'A2'), []);
});

test('cells pointing at a medicine that is gone are reported as stale', () => {
  assert.deepEqual(staleCells(data, ['m1', 'm2']).map((c) => c.unitId + c.code), ['u2A2']);
});
