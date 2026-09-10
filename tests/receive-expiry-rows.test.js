import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReceiveRecords, describeReceiveError } from '../public/assets/js/core/receive-expiry-rows.js';

/* A delivery of one medicine can arrive as more than one expiry date. The
   screen lets a department add a date and split the quantity; this is where the
   split is checked. */

const build = (rows) => buildReceiveRecords(rows, { requestId: 'req-1', now: '2026-03-01T09:00:00Z', newId: () => 'ex_fixed' });
const row = (over = {}) => ({ medId: 'med-a', received: 10, expiry: '2027-01-01', qty: 10, lot: '', ...over });

test('one date for the whole delivery is recorded as one batch', () => {
  const { records, received, errors } = build([row()]);
  assert.deepEqual(errors, []);
  assert.equal(records.length, 1);
  assert.deepEqual(
    { medId: records[0].medId, expiry: records[0].expiry, qty: records[0].qty, sourceRequestId: records[0].sourceRequestId },
    { medId: 'med-a', expiry: '2027-01-01', qty: 10, sourceRequestId: 'req-1' },
  );
  assert.deepEqual(received, [{ medId: 'med-a', qty: 10, expiry: '2027-01-01', batch: '' }]);
});

test('two boxes with different dates are two records', () => {
  const { records, errors } = build([
    row({ qty: 6, expiry: '2027-01-01', lot: 'L1' }),
    row({ qty: 4, expiry: '2028-05-01', lot: 'L2' }),
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(records.map((r) => [r.expiry, r.qty, r.lot]), [['2027-01-01', 6, 'L1'], ['2028-05-01', 4, 'L2']]);
});

test('the split must add up to what was received — not less', () => {
  /* The missing units would sit in the department with no expiry recorded,
     which is exactly what the expiry screen exists to prevent. */
  const { records, errors } = build([row({ qty: 6 }), row({ qty: 3, expiry: '2028-05-01' })]);
  assert.deepEqual(records, []);
  assert.equal(errors[0].reason, 'split-mismatch');
  assert.match(describeReceiveError(errors[0], () => 'Dextrose 50%'), /9 of 10/);
});

test('and not more — a record may not claim stock nobody delivered', () => {
  const { errors } = build([row({ qty: 8 }), row({ qty: 8, expiry: '2028-05-01' })]);
  assert.equal(errors[0].reason, 'split-mismatch');
  assert.equal(errors[0].total, 16);
});

test('a quantity with no date is refused, and says which medicine', () => {
  const { errors, records } = build([row({ expiry: '', qty: 10 })]);
  assert.deepEqual(records, []);
  assert.equal(errors[0].reason, 'quantity-without-date');
  assert.match(describeReceiveError(errors[0], () => 'Naloxone'), /Naloxone/);
  assert.match(describeReceiveError(errors[0], () => 'Naloxone'), /بلا تاريخ انتهاء/);
});

test('an extra line somebody added and left blank is dropped, not an error', () => {
  const { records, errors } = build([row({ qty: 10 }), row({ expiry: '', qty: 0 })]);
  assert.deepEqual(errors, []);
  assert.equal(records.length, 1);
  assert.equal(records[0].qty, 10);
});

test('a medicine nobody has filled in yet is simply not recorded', () => {
  const { records, errors } = build([row({ expiry: '', qty: 0 })]);
  assert.deepEqual(records, []);
  assert.deepEqual(errors, []);
});

test('each medicine is checked against its own received quantity', () => {
  const { records, errors } = build([
    row({ medId: 'med-a', received: 10, qty: 10 }),
    row({ medId: 'med-b', received: 4, qty: 1, expiry: '2027-02-01' }),
  ]);
  assert.deepEqual(records.map((r) => r.medId), ['med-a']);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].medId, 'med-b');
});

test('a batch number is optional and carried when given', () => {
  const { records } = build([row({ lot: 'B-77' })]);
  assert.equal(records[0].lot, 'B-77');
  assert.equal(records[0].batch, 'B-77');
});

test('nothing in, nothing out', () => {
  assert.deepEqual(build([]), { records: [], received: [], errors: [] });
  assert.deepEqual(buildReceiveRecords(null, {}).records, []);
});
