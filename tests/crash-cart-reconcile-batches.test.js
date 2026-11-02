import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

/* setCrashCarts passes every save through reconcileCrashCartData. It used to
   rebuild each batch from three fields, dropping batchId and sourceReportId —
   the very fields the smart bulk replacement reads back to verify its save, so
   every bulk save was reported as failed and rolled back. */
const src = fs.readFileSync(new URL('../public/assets/js/modules/49-asdh-final-persistence-actions-20260725.js', import.meta.url), 'utf8');
const start = src.indexOf('function reconcileCrashCartData');
const end = src.indexOf('\n}\n', start) + 3;
const reconcile = new Function('canonical', 'normalText', 'num', `${src.slice(start, end)};return reconcileCrashCartData`)(
  (o) => ({ generic: o.name, concentration: o.strength || '' }), (x) => String(x || '').toLowerCase(), Number);

test('reconciling keeps the identifying fields of every batch', () => {
  const out = reconcile([{ id: 'c', items: [{ id: 'i', name: 'A', strength: '1', batches: [
    { id: 'b1', batchId: 'b1', expiry: '2027-01-01', qty: '2', lot: 'L', sourceReportId: 'R1', source: 'x' }] }] }]);
  const b = out.carts[0].items[0].batches[0];
  assert.equal(b.sourceReportId, 'R1');
  assert.equal(b.batchId, 'b1');
  assert.equal(b.qty, 2);
});
