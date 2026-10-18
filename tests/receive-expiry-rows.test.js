import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReceiveRecords, describeReceiveError } from '../public/assets/js/core/receive-expiry-rows.js';

/* The department says WHICH expiry dates a delivery carries — it never types a
   quantity. It ticks dates it already holds or adds new ones; one delivery may
   carry several. */

const held = [
  { id: 'ex_1', medId: 'med-a', date: '2027-01-01', expiry: '2027-01-01', lot: 'L1', batch: 'L1', qty: 12 },
  { id: 'ex_2', medId: 'med-a', date: '2028-05-01', expiry: '2028-05-01', lot: '', batch: '', qty: null },
  { id: 'ex_3', medId: 'med-b', date: '2027-09-09', expiry: '2027-09-09', lot: '', batch: '', qty: 3 },
];
const build = (rows, over = {}) => buildReceiveRecords(rows, {
  requestId: 'req-1', now: '2026-03-01T09:00:00Z', newId: () => 'ex_fixed', existing: held, required: ['med-a'], ...over,
});

test('ticking a date the department already holds writes nothing new', () => {
  const { records, received, errors } = build([{ medId: 'med-a', existingId: 'ex_1' }]);
  assert.deepEqual(errors, []);
  assert.deepEqual(records, []);
  assert.deepEqual(received, [{ medId: 'med-a', expiry: '2027-01-01', batch: 'L1', source: 'existing', batchId: 'ex_1' }]);
});

test('a date that is not on the list is added, and its quantity is unrecorded, never zero', () => {
  const { records, received, errors } = build([{ medId: 'med-a', expiry: '2029-02-02', lot: 'N9' }]);
  assert.deepEqual(errors, []);
  assert.equal(records.length, 1);
  assert.equal(records[0].qty, null);
  assert.deepEqual(
    { id: records[0].id, medId: records[0].medId, expiry: records[0].expiry, date: records[0].date, lot: records[0].lot, batch: records[0].batch, sourceRequestId: records[0].sourceRequestId },
    { id: 'ex_fixed', medId: 'med-a', expiry: '2029-02-02', date: '2029-02-02', lot: 'N9', batch: 'N9', sourceRequestId: 'req-1' },
  );
  assert.deepEqual(received, [{ medId: 'med-a', expiry: '2029-02-02', batch: 'N9', source: 'new' }]);
});

test('one delivery can carry several dates, ticked and typed together', () => {
  const { records, received, errors } = build([
    { medId: 'med-a', existingId: 'ex_1' },
    { medId: 'med-a', existingId: 'ex_2' },
    { medId: 'med-a', expiry: '2029-02-02' },
    { medId: 'med-a', expiry: '2030-03-03' },
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(records.map((r) => r.expiry), ['2029-02-02', '2030-03-03']);
  assert.deepEqual(received.map((r) => r.expiry), ['2027-01-01', '2028-05-01', '2029-02-02', '2030-03-03']);
});

test('typing a date the department already holds is a selection, not a duplicate record', () => {
  /* The list normaliser merges equal rows and sums their quantities, which would
     turn an unrecorded quantity into 0. */
  const { records, received, errors } = build([{ medId: 'med-a', expiry: '2028-05-01', lot: '' }]);
  assert.deepEqual(errors, []);
  assert.deepEqual(records, []);
  assert.equal(received[0].source, 'existing');
  assert.equal(received[0].batchId, 'ex_2');
});

test('the same new date typed twice, or ticked and typed, is one date', () => {
  const { records, received } = build([
    { medId: 'med-a', expiry: '2029-02-02' },
    { medId: 'med-a', expiry: '2029-02-02' },
    { medId: 'med-a', existingId: 'ex_1' },
    { medId: 'med-a', expiry: '2027-01-01', lot: 'l1' },
  ]);
  assert.equal(records.length, 1);
  assert.equal(received.length, 2);
});

test('every dispensed medicine needs a date, and the error names it', () => {
  const { records, errors } = build([{ medId: 'med-b', existingId: 'ex_3' }], { required: ['med-a', 'med-b'] });
  assert.deepEqual(records, []);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].medId, 'med-a');
  assert.equal(errors[0].reason, 'no-date');
  const message = describeReceiveError(errors[0], () => 'Dextrose 50%');
  assert.match(message, /Dextrose 50%/);
  assert.match(message, /at least one expiry date/);
  assert.match(message, /تاريخ انتهاء واحد على الأقل/);
});

test('a failed receipt writes nothing at all — not even the medicines that were fine', () => {
  const { records, received, errors } = build(
    [{ medId: 'med-b', expiry: '2031-01-01' }],
    { required: ['med-a', 'med-b'] },
  );
  assert.equal(errors.length, 1);
  assert.deepEqual(records, []);
  assert.deepEqual(received, []);
});

test('a batch number with no date is refused, in both languages', () => {
  const { errors } = build([{ medId: 'med-a', expiry: '', lot: 'ZZ' }]);
  assert.equal(errors[0].reason, 'batch-without-date');
  const message = describeReceiveError(errors[0], () => 'Naloxone');
  assert.match(message, /Naloxone/);
  assert.match(message, /رقم دفعة بلا تاريخ انتهاء/);
});

test('a line somebody added and left blank is dropped, not an error', () => {
  const { records, errors, received } = build([
    { medId: 'med-a', existingId: 'ex_1' },
    { medId: 'med-a', expiry: '', lot: '' },
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(records, []);
  assert.equal(received.length, 1);
});

test('a malformed date is refused rather than saved', () => {
  const { errors } = build([{ medId: 'med-a', expiry: '03/04/2027' }]);
  assert.equal(errors[0].reason, 'invalid-date');
  assert.match(describeReceiveError(errors[0], () => 'X'), /تاريخ الانتهاء غير صالح/);
});

test('a tick that no longer matches the department list is refused', () => {
  const { errors } = build([{ medId: 'med-a', existingId: 'ex_gone' }]);
  assert.equal(errors[0].reason, 'stale-selection');
  /* A date from another medicine cannot be ticked for this one. */
  const crossed = build([{ medId: 'med-a', existingId: 'ex_3' }]);
  assert.equal(crossed.errors[0].reason, 'stale-selection');
  assert.match(describeReceiveError(errors[0], () => 'X'), /أعد فتح الاستلام/);
});

test('each medicine is judged on its own dates', () => {
  const { records, received, errors } = build(
    [
      { medId: 'med-a', existingId: 'ex_1' },
      { medId: 'med-b', expiry: '2031-01-01' },
    ],
    { required: ['med-a', 'med-b'] },
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(records.map((r) => r.medId), ['med-b']);
  assert.deepEqual(received.map((r) => r.medId), ['med-a', 'med-b']);
});

test('nothing in, nothing out', () => {
  assert.deepEqual(buildReceiveRecords([], { required: [] }), { records: [], received: [], errors: [] });
  assert.deepEqual(buildReceiveRecords(null, {}).records, []);
});
