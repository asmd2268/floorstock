import assert from 'node:assert/strict';
import { test } from 'node:test';
import { batchGapReason, collectBatchGaps } from '../public/assets/js/core/controlled-batch-gaps.js';

/* The report exists because the bulk editor wrote {expiry, qty:0} rows across
   several wards at once. Its whole value is naming those rows and NOT naming
   rows that are genuinely fine, so both halves are asserted. */

test('a row whose lots are counted and add up is not reported', () => {
  assert.equal(batchGapReason({ actualQty: 3, batches: [{ expiry: '2028-08-31', qty: 1 }, { expiry: '2028-11-30', qty: 2 }] }), null);
});

test('one dated lot with no number is settled — it can only be holding all of it', () => {
  /* This is reconcileBatchQuantities' single inference. The report must not
     invent work by disagreeing with the rule the editors save through. */
  assert.equal(batchGapReason({ actualQty: 3, batches: [{ expiry: '2028-08-31', qty: 0 }] }), null);
});

test('the shape the bulk editor left behind is reported as uncounted', () => {
  assert.equal(
    batchGapReason({ actualQty: 3, batches: [{ expiry: '2028-08-31', qty: 0 }, { expiry: '2028-11-30', qty: 0 }] }),
    'uncounted',
  );
});

test('counted lots that disagree with the actual are a discrepancy, not a blank', () => {
  assert.equal(batchGapReason({ actualQty: 5, batches: [{ expiry: '2029-01-31', qty: 2 }] }), 'mismatch');
});

test('stock held with no expiry date at all is reported', () => {
  assert.equal(batchGapReason({ actualQty: 2, batches: [] }), 'no-expiry');
});

test('a medicine the ward does not hold is nothing to chase', () => {
  assert.equal(batchGapReason({ actualQty: 0, batches: [] }), null);
  assert.equal(batchGapReason({ actualQty: 0, batches: [{ expiry: '2027-01-01', qty: 0 }] }), null);
});

test('the queue spans departments, worst first, and carries what the pharmacist needs', () => {
  const departments = [{ id: 'b', name: 'Ward B' }, { id: 'a', name: 'Ward A' }];
  const rows = (id) => ({
    a: [{ medId: 'm1', name: 'DIAZEPAM 10 MG INJ', actualQty: 3, batches: [{ expiry: '2028-08-31', qty: 0 }, { expiry: '2028-11-30', qty: 0 }] },
        { medId: 'm2', name: 'FINE', actualQty: 2, batches: [{ expiry: '2027-01-01', qty: 2 }] }],
    b: [{ medId: 'm3', name: 'MORPHINE 10 MG', actualQty: 1, batches: [] }],
  })[id] || [];

  const queue = collectBatchGaps(departments, rows, (row) => row.name);
  assert.deepEqual(queue.map((r) => [r.deptName, r.medName, r.reason]), [
    ['Ward B', 'MORPHINE 10 MG', 'no-expiry'],
    ['Ward A', 'DIAZEPAM 10 MG INJ', 'uncounted'],
  ]);
  assert.equal(queue[1].actual, 3);
  assert.equal(queue[1].counted, 0);
  assert.equal(queue[1].batches, 2);
});

test('a department whose list cannot be read is skipped, not fatal', () => {
  const queue = collectBatchGaps([{ id: 'x', name: 'X' }], () => { throw new Error('denied'); }, null);
  assert.deepEqual(queue, []);
});
