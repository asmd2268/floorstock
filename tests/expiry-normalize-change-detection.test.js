import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* fsR18NormalizeExpiryRows runs on every read of a department's expiry rows, and it
   used to decide "did this row change" by serialising it before and after. It now
   compares the seven fields the normaliser writes. This test keeps the two rules
   in agreement: the old rule is rebuilt here around the real row normaliser. */
const source = fs.readFileSync(new URL('../public/assets/js/modules/03c-medication-expiry-shelf-helpers.js', import.meta.url), 'utf8');
const start = source.indexOf('function fsR18ExpiryId()');
const end = source.indexOf('function fsR18ExpiryComparable');
const api = new Function(source.slice(start, end) + '\nreturn {norm: fsR17NormalizeExpiryRow, rows: fsR18NormalizeExpiryRows};')();

function oldRule(deptId, rows) {
  const used = {};
  let changed = false;
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const before = JSON.stringify(row || {});
    const next = api.norm(deptId, row, index, used);
    if (before !== JSON.stringify(next)) changed = true;
  });
  return changed;
}

const clean = (i) => ({ id: 'e' + i, batchId: 'e' + i, medId: 'm' + i, date: '2027-01-0' + (1 + (i % 9)), expiry: '2027-01-0' + (1 + (i % 9)), batch: 'L' + i, lot: 'L' + i, qty: i });

test('already-normalised rows are reported unchanged', () => {
  assert.equal(api.rows('d', [0, 1, 2].map(clean)).changed, false);
  assert.equal(api.rows('d', []).changed, false);
  assert.equal(api.rows('d', [Object.assign(clean(1), { note: 'x', qty: undefined })]).changed, false);
});

test('a row the normaliser rewrites is reported changed', () => {
  const noBatchId = clean(1); delete noBatchId.batchId;
  assert.equal(api.rows('d', [noBatchId]).changed, true);
  assert.equal(api.rows('d', [{ id: 'a', medicationId: 'm1', expiryDate: '2027-05-05T00:00:00Z', lotNo: 'X' }]).changed, true);
  assert.equal(api.rows('d', [Object.assign(clean(1), { id: 5, batchId: 5 })]).changed, true);
  assert.equal(api.rows('d', [null, clean(3)]).changed, true);
});

test('the field comparison agrees with the old serialise-and-compare rule', () => {
  let seed = 1;
  const next = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
  for (let i = 0; i < 1500; i += 1) {
    const row = clean(next() % 5);
    ['id', 'batchId', 'medId', 'date', 'expiry', 'batch', 'lot', 'qty', 'extra'].forEach((key) => {
      const r = next() % 7;
      if (r === 0) delete row[key]; else if (r === 1) row[key] = next() % 3 ? String(next() % 9) : next() % 9; else if (r === 2) row[key] = null; else if (r === 3) row[key] = '  ';
    });
    const rows = [row];
    const expected = oldRule('d', JSON.parse(JSON.stringify(rows)));
    // A duplicate-merge also reports changed; one row cannot merge with itself.
    assert.equal(api.rows('d', JSON.parse(JSON.stringify(rows))).changed, expected, JSON.stringify(row));
  }
});
