import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rowsFromTextItems, dedupeRows, normalizeCode, findMedicineByCode } from '../public/assets/js/core/receipt-pdf-rows.js';

/* Reading item rows out of a warehouse receipt PDF. These quantities become
   stock in the controlled warehouse, so what the parser decides is a quantity
   matters — and it had no test at all. */

/* A PDF text item: [scaleX, skewX, skewY, scaleY, x, y] is its transform. */
const at = (x, y, str) => ({ str, transform: [1, 0, 0, 1, x, y] });

test('fragments on one baseline become one row, read left to right', () => {
  const rows = rowsFromTextItems([
    at(300, 700, '12'),
    at(60, 700, '10012345'),
    at(120, 700, 'PARACETAMOL 500MG TAB'),
  ], 1);
  assert.deepEqual(rows, [{ page: 1, code: '10012345', description: 'PARACETAMOL 500MG TAB', qty: 12 }]);
});

test('a slightly raised fragment is still on the same line', () => {
  /* Text is not placed at exactly equal y; a superscript or a unit sitting a
     point higher must not become a row of its own. */
  const rows = rowsFromTextItems([
    at(60, 700, '10012345'),
    at(120, 701.5, 'AMOXICILLIN'),
    at(300, 699, '5'),
  ], 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].qty, 5);
});

test('a fragment on the next line is a different row', () => {
  const rows = rowsFromTextItems([
    at(60, 700, '10012345'), at(300, 700, '5'),
    at(60, 680, '10099999'), at(300, 680, '7'),
  ], 1);
  assert.deepEqual(rows.map((row) => row.code), ['10012345', '10099999']);
  assert.deepEqual(rows.map((row) => row.qty), [5, 7]);
});

test('rows come back in reading order, down the page', () => {
  const rows = rowsFromTextItems([
    at(60, 500, '10000002'), at(300, 500, '2'),
    at(60, 700, '10000001'), at(300, 700, '1'),
  ], 3);
  assert.deepEqual(rows.map((row) => row.code), ['10000001', '10000002']);
  assert.equal(rows[0].page, 3, 'every row carries the page it was read from');
});

test('a line with no item code is not a row at all', () => {
  /* Headers, totals, addresses and page furniture carry no code — skipped
     rather than guessed at. */
  const rows = rowsFromTextItems([
    at(60, 720, 'DELIVERY NOTE'), at(300, 720, '2026'),
    at(60, 700, 'Total'), at(300, 700, '19'),
    at(60, 680, '10012345'), at(300, 680, '4'),
  ], 1);
  assert.deepEqual(rows.map((row) => row.code), ['10012345']);
});

test('a code is 8 to 14 digits, after leading zeros and punctuation are stripped', () => {
  assert.equal(normalizeCode('0010012345'), '10012345');
  assert.equal(normalizeCode('100-123-45'), '10012345');
  assert.equal(normalizeCode('abc'), '');
  const short = rowsFromTextItems([at(60, 700, '1234567'), at(300, 700, '4')], 1);
  assert.deepEqual(short, [], 'seven digits is not an item code');
  const long = rowsFromTextItems([at(60, 700, '123456789012345'), at(300, 700, '4')], 1);
  assert.deepEqual(long, [], 'fifteen is not either');
});

test('the quantity is the LAST number on the row, not the first after the code', () => {
  /* Delivery notes put pack size and unit price between the code and the
     received quantity, and the quantity is the rightmost of them. */
  const rows = rowsFromTextItems([
    at(60, 700, '10012345'),
    at(120, 700, 'CEFTRIAXONE 1G VIAL'),
    at(260, 700, '10'),       // pack size
    at(320, 700, '3.50'),     // unit price
    at(400, 700, '250'),      // received
  ], 1);
  assert.equal(rows[0].qty, 250);
  assert.equal(rows[0].description, 'CEFTRIAXONE 1G VIAL 10 3.50', 'everything between the code and the quantity');
});

test('a quantity written with thousands separators still reads', () => {
  const rows = rowsFromTextItems([at(60, 700, '10012345'), at(300, 700, '1,250')], 1);
  assert.equal(rows[0].qty, 1250);
});

test('a row with no number after the code is skipped rather than counted as zero', () => {
  const rows = rowsFromTextItems([at(60, 700, '10012345'), at(120, 700, 'NO QUANTITY PRINTED')], 1);
  assert.deepEqual(rows, []);
});

test('a number BEFORE the code is never the quantity', () => {
  const rows = rowsFromTextItems([
    at(20, 700, '7'),          // line number in the leftmost column
    at(60, 700, '10012345'),
    at(300, 700, '12'),
  ], 1);
  assert.equal(rows[0].qty, 12);
});

test('the same row read twice from the text layer is one row', () => {
  const rows = [
    { page: 1, code: '10012345', qty: 5, description: 'A' },
    { page: 1, code: '10012345', qty: 5, description: 'A' },
    { page: 2, code: '10012345', qty: 5, description: 'A' },
    { page: 1, code: '10012345', qty: 6, description: 'A' },
  ];
  assert.equal(dedupeRows(rows).length, 3, 'same page and quantity is a repeat; a different page or quantity is not');
  assert.deepEqual(dedupeRows(null), []);
});

test('a row is matched to the catalog by either code the hospital files it under', () => {
  const catalog = [
    { id: 'm1', moh: '0010012345', nupco: '' },
    { id: 'm2', moh: '', nupco: '10099999' },
  ];
  assert.equal(findMedicineByCode(catalog, '10012345').id, 'm1');
  assert.equal(findMedicineByCode(catalog, '0010099999').id, 'm2');
  assert.equal(findMedicineByCode(catalog, '10000000'), null, 'an unknown code matches nothing, it does not guess');
  assert.equal(findMedicineByCode(catalog, ''), null);
  assert.equal(findMedicineByCode(null, '10012345'), null);
});

test('an empty page yields nothing, never a crash', () => {
  assert.deepEqual(rowsFromTextItems([], 1), []);
  assert.deepEqual(rowsFromTextItems(null, 1), []);
  assert.deepEqual(rowsFromTextItems([{ str: '   ' }], 1), []);
});
