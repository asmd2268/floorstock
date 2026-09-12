import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import { reconcileBatchQuantities, recordedBatchQuantities } from '../public/assets/js/core/controlled-batch-consumption.js';
import { fsR5NormalizeControlled } from '../public/assets/js/core/controlled-custody-data.js';
import { fsR12BatchSummaryHtml } from '../public/assets/js/core/controlled-expiry-format.js';

/* The batch-quantity round trip, end to end: what a custody row holds → what
   ctlPublishDept writes into public_controlled_expiry → what the public QR page
   and the department's own panel draw from it.

   Every controlled batch on both surfaces was rendering as `0` while the
   medicine's own quantity was right, and the MEDICINE column of the public page
   was empty. Those are the two halves of one habit: the publisher rebuilt each
   item from the catalogue and from ctlNum() instead of publishing what the
   custody row actually records — ctlNum('') is 0, and a session that cannot read
   controlled_catalog has no name to rebuild from.

   A `0` on a narcotic batch line is not a formatting slip: it says the lot is
   empty. So the publisher and both renderers are exercised here as real code —
   the two functions are lifted out of their modules and run against stubs —
   rather than asserted over source text. */

const publisherSource = fs.readFileSync(new URL('../public/assets/js/modules/07j-controlled-module-enhancements.js', import.meta.url), 'utf8');
const publicViewSource = fs.readFileSync(new URL('../public/assets/js/modules/81-public-live-view.js', import.meta.url), 'utf8');
const bulkEditorSource = fs.readFileSync(new URL('../public/assets/js/modules/28-v13-final-controlled-bulk-print-fix.js', import.meta.url), 'utf8');

const DEPT = 'fmw';
const MEDICINE = 'DIAZEPAM 10 MG INJ';

function evaluateInScope(source, scope) {
  // Non-strict by construction, so the module's bare global reads resolve to the stubs.
  return new Function('scope', 'with(scope){return (' + source + ')}')(scope);
}

/* Publishes one department and returns the document that reached Firestore.
   `catalogue` is deliberately empty by default: that is the session the empty
   MEDICINE column came from. */
async function publish(rows, catalogue = {}) {
  const body = publisherSource.match(/async function ctlPublishDept\(dept\)\{[\s\S]*?\n\}/);
  assert.ok(body, 'ctlPublishDept could not be located in modules/07j');

  let written = null;
  const scope = {
    recordedBatchQuantities,
    FB_DB: { collection: () => scope.collection },
    collection: { doc: () => ({ set: (value) => { written = value; return Promise.resolve(); } }) },
    fsTenantCollection: null,
    firebase: { firestore: { FieldValue: { serverTimestamp: () => 'server-time' } } },
    gd: () => [{ id: DEPT, name: 'FEMALE WARD' }],
    ctlDeptList: () => rows,
    ctlMedicine: (id) => catalogue[id] || null,
    ctlNum: (v) => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; },
    ctlSettingsGlobal: () => ({ expiryAlertDays: 30 }),
    CU: {},
  };
  scope.window = scope;
  await evaluateInScope(body[0], scope)(DEPT);
  assert.ok(written, 'nothing was published');
  return written;
}

/* The public QR page's own renderer, drawing the published document. */
function renderPublicPage(document) {
  const line = publicViewSource.split('\n').find((text) => text.startsWith('  function renderControlled(d){'));
  assert.ok(line, 'renderControlled could not be located in modules/81');
  const host = { innerHTML: '' };
  const scope = {
    publicRoot: () => host,
    esc2: (v) => String(v == null ? '' : v),
    n2: (v) => { const n = Number(v); return isFinite(n) ? n : 0; },
    dateTime: () => '—',
    dateOnly: (v) => String(v || ''),
  };
  evaluateInScope(line.trim().replace(/^function /, 'function '), scope)(document);
  return host.innerHTML;
}

/* The department's own read-only panel reads the same document through the
   custody normaliser. */
function renderDepartmentPanel(document) {
  return fsR5NormalizeControlled(document.items, 'test')
    .map((row) => fsR12BatchSummaryHtml(row.batches)).join('');
}

test('counted batch quantities survive the trip to both screens', async () => {
  const published = await publish([{
    medId: 'cm_545064870', name: MEDICINE, classification: 'narcotic',
    qty: 3, actualQty: 3,
    batches: [{ qty: 2, expiry: '2028-08-31', lot: '' }, { qty: 1, expiry: '2028-11-30', lot: '' }],
  }]);

  assert.deepEqual(published.items[0].batches, [
    { expiry: '2028-08-31', qty: 2 },
    { expiry: '2028-11-30', qty: 1 },
  ]);
  assert.equal(published.items[0].qty, 3);

  const publicHtml = renderPublicPage(published);
  assert.match(publicHtml, /2 → 2028-08-31/);
  assert.match(publicHtml, /1 → 2028-11-30/);
  assert.doesNotMatch(publicHtml, /0 → /, 'a counted batch may never be drawn as an empty lot');

  const panelHtml = renderDepartmentPanel(published);
  assert.match(panelHtml, /<span class="chip">2<\/span>/);
  assert.match(panelHtml, /<span class="chip">1<\/span>/);
});

test('the medicine name comes from the custody row when the catalogue is unreadable', async () => {
  const published = await publish([{ medId: 'cm_545064870', name: MEDICINE, qty: 3, actualQty: 3, batches: [] }]);
  assert.equal(published.items[0].name, MEDICINE);
  assert.match(renderPublicPage(published), new RegExp(MEDICINE));
});

test('a quantity nobody recorded is published as unknown, never as a zero', async () => {
  /* Two shapes reach the publisher with nothing counted per batch: the legacy
     rows that carry the total on the row (qty 0 on every batch), and the rows the
     custody reader caches after a REST read, where an absent quantity is ''. */
  for (const missing of [0, '', undefined]) {
    const published = await publish([{
      medId: 'cm_545064870', name: MEDICINE, qty: 3, actualQty: 3,
      batches: [{ qty: missing, expiry: '2028-08-31', lot: '' }, { qty: missing, expiry: '2028-11-30', lot: '' }],
    }]);
    assert.deepEqual(published.items[0].batches.map((b) => b.qty), ['', ''], String(missing));

    const publicHtml = renderPublicPage(published);
    assert.doesNotMatch(publicHtml, /0 → /, 'an uncounted batch drawn as 0 reads as an empty lot');
    assert.match(publicHtml, /2028-08-31/);
    assert.doesNotMatch(publicHtml, /\s→ 2028-08-31/, 'no dangling arrow where the number is not known');

    assert.doesNotMatch(renderDepartmentPanel(published), /chip/, 'no chip for a quantity that was never counted');
  }
});

test('a lot that really is empty still reads as empty', async () => {
  const published = await publish([{
    medId: 'cm_545064870', name: MEDICINE, qty: 0, actualQty: 0,
    batches: [{ qty: 0, expiry: '2028-08-31', lot: '' }],
  }]);
  assert.deepEqual(published.items[0].batches.map((b) => b.qty), [0]);
});

test('recordedBatchQuantities separates "none left" from "never counted"', () => {
  assert.deepEqual(recordedBatchQuantities([{ qty: 2 }, { qty: 1 }], 3), [2, 1]);
  assert.deepEqual(recordedBatchQuantities([{ qty: 0 }, { qty: 0 }], 3), ['', '']);
  assert.deepEqual(recordedBatchQuantities([{ qty: 0 }], 0), [0]);
  assert.deepEqual(recordedBatchQuantities([{ qty: 2 }, { qty: '' }], 3), [2, '']);
});

test('the bulk department editor cannot write a batch quantity nobody entered', () => {
  // One dated batch can only be holding all of it; that is the single inference.
  assert.deepEqual(reconcileBatchQuantities(3, [{ expiry: '2028-08-31', qty: 0, lot: '' }]).batches,
    [{ expiry: '2028-08-31', qty: 3, lot: '' }]);

  // A second batch with a blank quantity is refused, not written as zero.
  const refused = reconcileBatchQuantities(3, [
    { expiry: '2028-08-31', qty: 2, lot: '' },
    { expiry: '2028-11-30', qty: 0, lot: '' },
  ]);
  assert.ok(refused.error);
  assert.equal(refused.batches, undefined);

  assert.deepEqual(reconcileBatchQuantities(0, [{ expiry: '2028-08-31', qty: 0 }]).batches, []);

  // And the bulk editor is wired to that rule, ahead of every write it makes.
  const applyBulk = bulkEditorSource.match(/async function applyBulk\(\)\{[\s\S]*?\n\}/)[0];
  assert.match(applyBulk, /reconcileBatchQuantities\(/);
  assert.ok(applyBulk.indexOf('reconcileBatchQuantities(') < applyBulk.indexOf('await ctlSetDeptList('),
    'every selected department is reconciled before any of them is written');
});
