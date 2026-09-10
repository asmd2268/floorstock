import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildTxnRecords, applyNewLocations } from '../public/assets/js/core/pharmacy-inventory-transactions.js';

/* Stock movements typed into a grid: what makes a row acceptable, and what
   happens to a shelf the medicine was never assigned to. Both rules were inside
   a DOM handler with no test. */

const row = (over = {}) => ({ med: 'Paracetamol 500mg', qty: '10', location: 'r1|c1|s1', ...over });
const build = (over = {}) => buildTxnRecords({
  type: 'receipt', sharedDate: '2026-03-01', actor: 'Ali', purgeDays: 365,
  now: Date.UTC(2026, 2, 1), newId: () => 'fixed-id', ...over,
});

test('only the medicine and where it sits are required', () => {
  /* Refusing an entry over a batch number nobody has to hand just means the
     movement goes unrecorded, which is worse than an incomplete record. */
  const { records, errors } = build({ rows: [row({ qty: '', expiry: '', batchNo: '', supplier: '', note: '' })] });
  assert.deepEqual(errors, []);
  assert.equal(records.length, 1);
  assert.equal(records[0].qty, 0);
  assert.equal(records[0].batchNo, '');
});

test('a row with no medicine or no location is refused, by row number', () => {
  const { records, errors } = build({ rows: [row({ med: '  ' }), row({ location: '' }), row()] });
  assert.equal(records.length, 1, 'the good row still saves');
  assert.match(errors[0], /Row 1: medicine name required/);
  assert.match(errors[1], /Row 2: location required/);
});

test('a negative quantity is refused — it is a different movement, not this one', () => {
  const { records, errors } = build({ rows: [row({ qty: '-5' })] });
  assert.equal(records.length, 0);
  assert.match(errors[0], /cannot be negative/);
});

test('a quantity that is not a number is recorded as none rather than NaN', () => {
  const { records } = build({ rows: [row({ qty: 'ten' })] });
  assert.equal(records[0].qty, 0);
});

test('the location is split into room, cabinet and shelf', () => {
  const { records } = build({ rows: [row({ location: 'r9|c8|s7' })] });
  assert.deepEqual(
    { roomId: records[0].roomId, cabId: records[0].cabId, shelfId: records[0].shelfId },
    { roomId: 'r9', cabId: 'c8', shelfId: 's7' },
  );
});

test('a partial location does not invent the parts it does not have', () => {
  const { records } = build({ rows: [row({ location: 'r9' })] });
  assert.deepEqual({ cab: records[0].cabId, shelf: records[0].shelfId }, { cab: '', shelf: '' });
});

test('one date is written on every row of the entry', () => {
  const { records } = build({ sharedDate: '2026-03-05', rows: [row(), row({ med: 'Zinc' })] });
  assert.deepEqual(records.map((r) => r.date), ['2026-03-05', '2026-03-05']);
});

test('supplier and batch belong to a receipt, not to a dispense', () => {
  const receipt = build({ rows: [row({ batchNo: 'B-1', supplier: 'NUPCO' })] }).records[0];
  assert.equal(receipt.batchNo, 'B-1');
  assert.equal(receipt.supplier, 'NUPCO');
  const dispense = build({ type: 'dispense', rows: [row({ batchNo: 'B-1', supplier: 'NUPCO' })] }).records[0];
  assert.equal(dispense.batchNo, undefined, 'a dispense has no supplier to record');
  assert.equal(dispense.expiry, '', 'but it still carries expiry when known');
});

test('every movement carries when it may be purged', () => {
  const { records } = build({ purgeDays: 30, now: Date.UTC(2026, 2, 1), rows: [row()] });
  assert.equal(records[0].purgeAfter, new Date(Date.UTC(2026, 2, 31)).toISOString(), '30 days after it was recorded');
  assert.equal(records[0].createdBy, 'Ali', 'and who recorded it');
});

test('a shelf the medicine was not assigned to becomes one of its locations', () => {
  const meds = [{ name: 'Paracetamol 500mg', locations: [] }];
  const { records } = build({ rows: [row()] });
  const applied = applyNewLocations(meds, records);
  assert.equal(applied.added, 1);
  assert.deepEqual(meds[0].locations, [{ roomId: 'r1', cabId: 'c1', shelfId: 's1', expiry: '' }]);
});

test('a location already recorded is not added twice', () => {
  const meds = [{ name: 'Paracetamol 500mg', locations: [{ roomId: 'r1', cabId: 'c1', shelfId: 's1', expiry: '2026-09-01' }] }];
  const applied = applyNewLocations(meds, build({ rows: [row()] }).records);
  assert.equal(applied.added, 0);
  assert.equal(meds[0].locations.length, 1);
  assert.equal(meds[0].locations[0].expiry, '2026-09-01', 'and the expiry already recorded is not wiped');
});

test('the medicine is matched the way the person typing matches it', () => {
  const meds = [{ name: '  paracetamol 500MG ' }];
  const applied = applyNewLocations(meds, build({ rows: [row()] }).records);
  assert.equal(applied.added, 1);
});

test('a medicine the catalog does not know is not invented', () => {
  const meds = [{ name: 'Something else' }];
  const applied = applyNewLocations(meds, build({ rows: [row()] }).records);
  assert.equal(applied.added, 0);
  assert.equal(meds.length, 1, 'the movement is still recorded; the catalog is not edited');
});

test('a movement with no shelf recorded assigns nothing', () => {
  const meds = [{ name: 'Paracetamol 500mg', locations: [] }];
  const applied = applyNewLocations(meds, build({ rows: [row({ location: 'r1' })] }).records);
  assert.equal(applied.added, 0);
});

test('nothing in, nothing out', () => {
  assert.deepEqual(build({ rows: [] }), { records: [], errors: [] });
  assert.deepEqual(applyNewLocations(null, null), { meds: [], added: 0 });
});
