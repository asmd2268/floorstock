import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const core = require('../functions/crash-cart-report-core.js');

/* A department could report a consumed quantity without saying which batch it
   came from. The pharmacy response screen then had nothing to deduct it from:
   it refused to save with "contact a pharmacy admin", and the only way out was
   closing the cart with the quantity never replaced. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);

function cart() {
  return {
    id: 'cart1',
    deptId: 'icu',
    seal: '111',
    items: [
      { id: 'i1', name: 'Magnesium Sulfate 10%', qty: 2, present: 2, batches: [{ expiry: '2026-11-30', qty: 2 }] },
      { id: 'i2', name: 'Lidocaine 2%', qty: 2, present: 2, batches: [] },
    ],
  };
}

function submit(consumed) {
  return core.applyCrashCartReport({
    carts: [cart()],
    reports: [],
    cartId: 'cart1',
    departmentId: 'icu',
    reason: 'Emergency',
    oldSeal: '111',
    consumed,
    noConsumption: false,
    actorName: 'Nurse',
    stamp: '2026-09-09T00:00:00.000Z',
  });
}

test('a medicine with dated batches cannot be reported without its expiry', () => {
  assert.throws(() => submit([{ itemId: 'i1', qty: 1 }]), /choose the expiry date/i);
});

test('the expiry must be one of the cart’s own batches', () => {
  // Otherwise a typed date invents a batch, and the deduction has nothing to
  // take the quantity from.
  assert.throws(() => submit([{ itemId: 'i1', qty: 1, reportedExpiry: '2030-01-01' }]), /not one of the batches/i);
});

test('a medicine with no dated batches is still reportable', () => {
  // There is nothing to choose, and blocking the report would strand the
  // department instead of the pharmacist.
  const result = submit([{ itemId: 'i2', qty: 1 }]);
  assert.equal(result.report.consumed[0].itemId, 'i2');
  assert.equal(result.report.consumed[0].reportedExpiry, '');
});

test('a correctly dated line is accepted and carries its date', () => {
  const result = submit([{ itemId: 'i1', qty: 1, reportedExpiry: '2026-11-30' }]);
  assert.equal(result.report.consumed[0].reportedExpiry, '2026-11-30');
});

test('the browser asks for the same thing before the call is made', async () => {
  const form = await readFile(new URL('modules/80-controlled-pharmacy-ui-redesign.js', jsRoot), 'utf8');
  const submitSource = await readFile(new URL('modules/52-r635-master-backup-delete-and-crash-print-sync.js', jsRoot), 'utf8');
  // No blank option once the cart has dated batches, and the hint says required.
  assert.match(form, /ccExpiryOptions\(displayItem,reportedExpiry,!ccDatedBatches\(displayItem\)\.length\)/);
  // A placeholder rather than a pre-selected first date, so the choice is made
  // deliberately instead of defaulting to whichever batch sorts first.
  assert.match(form, /Choose the batch date\.\.\. \/ اختر تاريخ الدفعة\.\.\./);
  assert.match(submitSource, /choose the expiry date the quantity was taken from/);
  assert.ok(!/تاريخ الكمية المستخدمة — اختياري/.test(form), 'the field is no longer optional');
});

test('an older dateless report lets the pharmacist choose the batch instead of failing', async () => {
  const response = await readFile(new URL('modules/80-controlled-pharmacy-ui-redesign.js', jsRoot), 'utf8');
  assert.match(response, /class="ccc-src-exp"/);
  assert.match(response, /Choose the batch this quantity is deducted from/);
  assert.ok(!/contact a pharmacy admin/.test(response), 'the dead end is gone');
  // And the plan falls back to that pick when the report carries no date.
  assert.match(response, /ccDateKey\(row\.dataset\.reportedExpiry\|\|''\)\|\|ccDateKey\(srcPick\?srcPick\.value:''\)/);
});

test('a replacement below the cart standard is allowed, only above is refused', async () => {
  const response = await readFile(new URL('modules/80-controlled-pharmacy-ui-redesign.js', jsRoot), 'utf8');
  const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(response, /result>standard\+0\.000001/);
  assert.ok(!/result<standard[^\-]*error=/.test(response), 'below standard must not be an error');
  assert.match(page, /may be below the standard/);
});

test('each row group carries its own section colour, set on the cells', async () => {
  /* The reported rows were a 5% red wash that read as plain black on the dark
     surface, so the three groups in the table looked like one list. A background
     on the row itself is painted over by the cells, which is why it never showed
     — it is set on the cells now, matching each group's own header. */
  const css = await readFile(new URL('../public/assets/css/modules/03-styles-13-18.css', import.meta.url), 'utf8');
  const response = await readFile(new URL('modules/80-controlled-pharmacy-ui-redesign.js', jsRoot), 'utf8');
  assert.match(css, /tr\.ccc-row-reported>td\{background:rgba\(180,40,40,\.20\)/);
  assert.match(css, /tr\.ccc-row-below>td\{background:rgba\(200,100,20,/);
  assert.match(css, /tr\.crash-response-error>td\{background:rgba\(218,54,51,/);
  // No inline tints left to disagree with the stylesheet.
  assert.ok(!/background:rgba\(180,40,40,\.05\)/.test(response));
  assert.ok(!/rowStyle/.test(response), 'row colour belongs in one place');
});

test('the checkbox says what ticking it does', async () => {
  /* "Not currently available" with a bare box next to it did not say what
     happens if you tick it, and the cell stacked name, box and error text with
     no order to them. */
  const response = await readFile(new URL('modules/80-controlled-pharmacy-ui-redesign.js', jsRoot), 'utf8');
  const css = await readFile(new URL('../public/assets/css/modules/03-styles-13-18.css', import.meta.url), 'utf8');
  assert.match(response, /Out of pharmacy stock \/ غير متوفر بالصيدلية/);
  assert.match(response, /Close with no replacement — the cart stays below standard/);
  assert.match(response, /Leave as it is \/ اتركه كما هو/);
  assert.match(css, /\.ccc-unavailable-note\{/);
  // The outcome line is its own band, not more text under the medicine name.
  assert.match(css, /\.ccc-row-result:empty\{display:none\}/);
});
