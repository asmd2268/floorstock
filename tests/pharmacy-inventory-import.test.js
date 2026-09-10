import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseMedicineImport } from '../public/assets/js/core/pharmacy-inventory-import.js';

/* Reading a pasted list of medicines. Nothing is written by this function: the
   caller is told what would be imported and what was skipped, with a reason,
   so a row that did not arrive is visible now rather than missing later. */

const parse = (raw, over = {}) => parseMedicineImport(raw, { now: '2026-03-01T00:00:00Z', actor: 'ali@hospital', newId: () => 'id', ...over });

test('a paste from Excel and a paste from a CSV both read', () => {
  const tabbed = parse('Paracetamol\tM-1\tN-1');
  const comma = parse('Paracetamol,M-1,N-1');
  assert.deepEqual(
    [tabbed.imported[0].name, tabbed.imported[0].mohCode, tabbed.imported[0].nupcoCode],
    ['Paracetamol', 'M-1', 'N-1'],
  );
  assert.deepEqual(comma.imported[0], tabbed.imported[0]);
});

test('the spreadsheet\'s own header row is not imported as a medicine', () => {
  const { imported, skipped } = parse('Name,MOH,Nupco\nParacetamol,M-1,N-1');
  assert.deepEqual(imported.map((m) => m.name), ['Paracetamol']);
  assert.match(skipped[0], /Row 1: header/);
  // Only the FIRST line can be a header: a medicine really called "Name" later
  // in the list is still a medicine.
  const later = parse('Paracetamol,M-1\nName,M-2');
  assert.equal(later.imported.length, 2);
});

test('a medicine already in the catalog is skipped, and said so by name', () => {
  const { imported, skipped } = parse('Paracetamol,M-9', { existing: [{ name: 'paracetamol' }] });
  assert.deepEqual(imported, []);
  assert.deepEqual(skipped, ['Paracetamol (duplicate)']);
});

test('the same medicine twice in one paste is imported once', () => {
  const { imported, skipped } = parse('Zinc,M-1\nZinc,M-2\nIron,M-3');
  assert.deepEqual(imported.map((m) => m.name), ['Zinc', 'Iron']);
  assert.equal(skipped.length, 1);
});

test('blank lines and stray spacing do not become medicines', () => {
  const { imported } = parse('  Zinc  ,  M-1  \n\n   \n,,\nIron');
  assert.deepEqual(imported.map((m) => m.name), ['Zinc', 'Iron']);
  assert.equal(imported[0].mohCode, 'M-1', 'and the codes are trimmed too');
});

test('a row with only a name is a complete medicine', () => {
  /* Codes get filled in later; refusing the row would mean the pharmacy keeps
     the list in a spreadsheet instead. */
  const { imported } = parse('Zinc');
  assert.equal(imported.length, 1);
  assert.deepEqual([imported[0].mohCode, imported[0].nupcoCode], ['', '']);
});

test('every imported medicine starts in stock, unlocated, and stamped', () => {
  const { imported } = parse('Zinc', { classification: 'ha' });
  assert.deepEqual(imported[0].locations, []);
  assert.equal(imported[0].outOfStock, false);
  assert.equal(imported[0].expiry, '', 'nothing is claimed about an expiry nobody typed');
  assert.equal(imported[0].classification, 'ha', 'the classification chosen for the whole paste');
  assert.equal(imported[0].updatedBy, 'ali@hospital');
  assert.equal(imported[0].updatedAt, '2026-03-01T00:00:00Z');
});

test('a paste of nothing but duplicates reports nothing to import', () => {
  const { imported, skipped } = parse('Zinc\nIron', { existing: [{ name: 'Zinc' }, { name: 'Iron' }] });
  assert.deepEqual(imported, []);
  assert.equal(skipped.length, 2);
});

test('nothing in, nothing out', () => {
  assert.deepEqual(parse(''), { imported: [], skipped: [] });
  assert.deepEqual(parse(null), { imported: [], skipped: [] });
});
