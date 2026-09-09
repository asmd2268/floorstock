import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  fsR5ControlledMedicine,
  fsR5NormalizeControlled,
} from '../public/assets/js/core/controlled-custody-data.js';

/* The ninth slice out of modules/51: reading a department's controlled custody.

   Normalisation is the part worth pinning. The same batch has been written five
   different ways over the life of this project — as `batches`, `batchList`,
   `lots`, `expiryBatches`, or flattened onto the row itself — with the quantity
   under any of four names. Every one of those shapes is still in Firestore, so
   every one of them has to keep reading. */

const UNKNOWN = 'Unknown medicine / دواء غير معروف';

test('a row with no medicine still reads, named as unknown', () => {
  const [row] = fsR5NormalizeControlled([{ id: 'm1', actualQty: 3 }], 'test');
  assert.equal(row.name, UNKNOWN);
  assert.equal(row.key, 'm1');
  assert.equal(row.actual, 3);
  assert.equal(row.classification, 'narcotic', 'a controlled row is narcotic unless it says otherwise');
});

test('a row with no id at all keeps its position, so nothing silently vanishes', () => {
  const rows = fsR5NormalizeControlled([{ qty: 1 }, { qty: 2 }], 'test');
  assert.deepEqual(rows.map((row) => row.key), ['row_0', 'row_1']);
});

test('every stored batch shape reads back the same', () => {
  const expected = { lot: 'L1', expiry: '2026-03-01', qty: 5 };
  const shapes = [
    { id: 'a', batches: [{ lot: 'L1', expiry: '2026-03-01', qty: 5 }] },
    { id: 'a', batchList: [{ lotNo: 'L1', expiryDate: '2026-03-01', quantity: 5 }] },
    { id: 'a', lots: [{ batchNo: 'L1', expDate: '2026-03-01', available: 5 }] },
    { id: 'a', expiryBatches: [{ batchNumber: 'L1', date: '2026-03-01', actualQty: 5 }] },
    // The oldest shape of all: one batch flattened onto the row.
    { id: 'a', lot: 'L1', expiry: '2026-03-01', qty: 5 },
  ];
  for (const shape of shapes) {
    const [row] = fsR5NormalizeControlled([shape], 'test');
    assert.deepEqual(row.batches, [expected], JSON.stringify(shape));
  }
});

test('a batch holding nothing but blanks is dropped', () => {
  const [row] = fsR5NormalizeControlled([{ id: 'a', batches: [{ lot: '', expiry: '', qty: '' }, { expiry: '2026-03-01' }] }], 'test');
  assert.equal(row.batches.length, 1);
  assert.equal(row.batches[0].expiry, '2026-03-01');
  assert.equal(row.batches[0].qty, '', 'an unrecorded quantity stays unrecorded, it does not become zero');
});

test('a zero quantity is kept as zero — it is a counted fact, not a blank', () => {
  const [row] = fsR5NormalizeControlled([{ id: 'a', batches: [{ lot: 'L1', qty: 0 }] }], 'test');
  assert.equal(row.batches[0].qty, 0);
});

test('the required quantity falls back through its three names, then to a dash', () => {
  const read = (row) => fsR5NormalizeControlled([row], 'test')[0].required;
  assert.equal(read({ id: 'a', requiredQty: 4 }), 4);
  assert.equal(read({ id: 'a', required: 4 }), 4);
  assert.equal(read({ id: 'a', max: 4 }), 4);
  assert.equal(read({ id: 'a' }), '—', 'a standard nobody set is unknown, not zero');
});

test('the actual quantity prefers what was counted over what was requested', () => {
  const read = (row) => fsR5NormalizeControlled([row], 'test')[0].actual;
  assert.equal(read({ id: 'a', actualQty: 2, available: 9, qty: 9 }), 2);
  assert.equal(read({ id: 'a', available: 9, qty: 3 }), 9);
  assert.equal(read({ id: 'a', qty: 3 }), 3);
});

test('the source of every row is carried, so a screen can say where it read from', () => {
  const [row] = fsR5NormalizeControlled([{ id: 'a' }], 'public-rest');
  assert.equal(row.source, 'public-rest');
});

test('a medicine the catalog does not know still yields the row’s own fields', () => {
  const medicine = fsR5ControlledMedicine('missing', { name: 'Morphine 10mg', mohCode: 'M-1', nupco: 'N-1', classification: 'psychotropic' });
  assert.equal(medicine.name, 'Morphine 10mg');
  assert.equal(medicine.moh, 'M-1');
  assert.equal(medicine.nupco, 'N-1');
  assert.equal(medicine.classification, 'psychotropic');
});

test('nothing in, nothing out — never a crash', () => {
  assert.deepEqual(fsR5NormalizeControlled(null, 'test'), []);
  assert.deepEqual(fsR5NormalizeControlled(undefined, 'test'), []);
  assert.equal(fsR5NormalizeControlled([null], 'test').length, 1);
});
