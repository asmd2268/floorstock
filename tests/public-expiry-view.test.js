import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import {
  expiryBatchesForShelf, groupExpiryByMedication, expiryBatchStatus, expiryQtyLabel,
} from '../public/assets/js/core/public-expiry-view.js';

/* The public Expiry Monitor. The register stores one row per BATCH and the
   publisher publishes every one of them, so a medicine with three registered
   dates reaches the page three times. The page used to render those as three
   unrelated rows: the nearest date near the top, the others wherever the
   register happened to put them, which is how a ward reads a list as holding
   one date per medicine and leaves a second expired box on the shelf. */

/* Shaped like public_expiry/<dept>.batches, which is what the department
   actually has today: two dates for one medicine, and no quantity anywhere
   because the expiry form does not ask for one. */
const published = [
  { medication: 'Dextrose 50% w/v Vial', date: '2027-11-30', qty: '', highAlert: true, lasa: true, shelfIds: ['sh_a'], shelfNames: ['cabinet 2'] },
  { medication: 'Digoxin 0.5mg/2ml Ampoule', date: '2027-06-30', qty: '', highAlert: true, shelfIds: ['sh_a'], shelfNames: ['cabinet 2'] },
  { medication: 'Dextrose 50% w/v Vial', date: '2027-05-31', qty: '', highAlert: true, lasa: true, shelfIds: ['sh_a'], shelfNames: ['cabinet 2'] },
  { medication: 'Sodium Chloride 0.9% Vial', date: '2026-01-31', qty: 4, shelfIds: ['sh_b'], shelfNames: ['cabinet 3'] },
];

test('every date registered for a medicine is on that medicine\'s row', () => {
  const groups = groupExpiryByMedication(published);
  assert.deepEqual(groups.map((g) => g.name), [
    'Dextrose 50% w/v Vial', 'Digoxin 0.5mg/2ml Ampoule', 'Sodium Chloride 0.9% Vial',
  ], 'one row per medicine, in the order the register first mentions each');
  assert.deepEqual(groups[0].batches.map((b) => b.date), ['2027-05-31', '2027-11-30'],
    'both of the medicine\'s dates, nearest first — the second one was the bug');
});

test('a medicine whose name differs only in case or spacing is still one row', () => {
  const groups = groupExpiryByMedication([
    { medication: 'Warfarin 1 mg Tablet', date: '2027-03-30' },
    { medication: ' warfarin 1 mg tablet ', date: '2026-12-31' },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, 'Warfarin 1 mg Tablet', 'the name is shown as first registered');
  assert.deepEqual(groups[0].batches.map((b) => b.date), ['2026-12-31', '2027-03-30']);
});

test('a batch with no date sorts last, not to the top of the medicine', () => {
  const groups = groupExpiryByMedication([
    { medication: 'Heparin', date: '' },
    { medication: 'Heparin', date: '2027-01-31' },
  ]);
  assert.deepEqual(groups[0].batches.map((b) => b.date), ['2027-01-31', '']);
});

test('the classification flags and drawers come from the medicine, not from one batch', () => {
  const [dextrose] = groupExpiryByMedication(published);
  assert.equal(dextrose.first.highAlert, true);
  assert.deepEqual(dextrose.first.shelfNames, ['cabinet 2']);
});

test('a drawer QR lists that drawer only, and says nothing when it holds nothing', () => {
  assert.equal(expiryBatchesForShelf(published, 'sh_b').length, 1);
  assert.equal(expiryBatchesForShelf(published, '').length, 4, 'no shelf asked for means the whole department');
  assert.deepEqual(expiryBatchesForShelf(published, 'sh_missing'), [],
    'a drawer published under no batch lists nothing rather than the whole department');
});

test('a date already past is called expired, and today is called today', () => {
  assert.equal(expiryBatchStatus({ date: '2026-01-31' }, '2026-09-12'), 'expired');
  assert.equal(expiryBatchStatus({ date: '2026-09-12' }, '2026-09-12'), 'today');
  assert.equal(expiryBatchStatus({ date: '2027-05-31' }, '2026-09-12'), '');
  assert.equal(expiryBatchStatus({ date: '' }, '2026-09-12'), '');
});

test('no quantity recorded reads as —, and zero reads as zero', () => {
  /* The publisher writes '' when the expiry row carries no quantity, which the
     page printed as an empty cell — indistinguishable from a rendering fault.
     0 is a real count and must survive. */
  assert.equal(expiryQtyLabel({ qty: '' }), '—');
  assert.equal(expiryQtyLabel({}), '—');
  assert.equal(expiryQtyLabel({ qty: 0 }), '0');
  assert.equal(expiryQtyLabel({ qty: 4 }), '4');
});

test('the monitor renders one row per medicine and asks the grouping, not the raw array', () => {
  const source = fs.readFileSync(new URL('../public/assets/js/modules/81-public-live-view.js', import.meta.url), 'utf8');
  const renderExpiry = source.match(/function renderExpiry\(d,dept\)\{[\s\S]*?\n  function /)[0];
  assert.match(renderExpiry, /groupExpiryByMedication\(expiryBatchesForShelf\(/);
  assert.doesNotMatch(renderExpiry, /\(d\.batches\|\|\[\]\)\.map/, 'a row per published batch is the defect');
  assert.match(renderExpiry, /expiryQtyLabel/, 'the Qty column says — rather than nothing at all');
});

test('printing a shelf list publishes the document its QR points at', () => {
  /* The QR is taped to a drawer. Printing one used to publish nothing, so the
     code on the paper could name a document that did not exist, or one whose
     drawer assignments predated the cabinet being rearranged. */
  const source = fs.readFileSync(new URL('../public/assets/js/modules/07f-shelves.js', import.meta.url), 'utf8');
  const printShelfList = source.match(/async function printShelfList\(\)\{[\s\S]*?getPublicExpiryUrl/)[0];
  assert.match(printShelfList, /await syncPublicExpiry\(deptId,getExpiry\(deptId\)\|\|\[\]\)/);
  assert.match(printShelfList, /warnPublicSync\('Shelf list QR'/);
  // A placeholder QR must stop the print, the way every other QR sheet does.
  assert.match(source, /class="asd-qr-image"/);
  assert.match(source, /ASD_QR\.printRuntimeScript/);
  assert.doesNotMatch(source, /<script>\(function\(\)\{var d=false/);
});
