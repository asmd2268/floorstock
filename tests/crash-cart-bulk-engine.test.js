import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildCrashBulkResult, removeFromItem, addReplacement, usedSeals, itemKey,
} from '../public/assets/js/core/crash-cart-bulk-engine.js';

/* Opening several crash carts at once. This changes what a sealed emergency
   cart contains and writes the record that says so — and it had no test. */

const normalize = (v) => String(v || '').toLowerCase().trim();
const deps = {
  now: () => '2026-03-01T09:00:00.000Z',
  actor: () => ({ name: 'Ali', user: 'ali@hospital', id: 'u1' }),
  newId: (prefix) => `${prefix}_fixed`,
  normalize,
  sealIsValid: (seal) => String(seal).length >= 3,
};

const item = (over = {}) => ({ id: 'i1', name: 'Adrenaline', concentration: '1mg', qty: 4, present: 4, batches: [{ batchId: 'b1', expiry: '2026-06-01', qty: 4, lot: 'L1' }], ...over });
const cart = (over = {}) => ({ id: 'c1', name: 'ICU cart', deptId: 'icu', seal: 'S-100', items: [item()], ...over });
const plan = (over = {}) => ({
  sourceKey: itemKey(item(), normalize),
  sourceExpiry: '2026-06-01',
  replacements: [{ id: 'r1', name: 'Adrenaline', concentration: '1mg', qty: 4, expiry: '2027-01-01', lot: 'L9' }],
  cartPlans: [{ cartId: 'c1', newSeal: 'S-200', removeQty: 4, replacements: { r1: { include: true } } }],
  ...over,
});

const run = (carts, reports, p) => buildCrashBulkResult(carts, reports, p, deps);

test('a cart never ends up holding more than its approved standard', () => {
  /* Refused, not silently capped: "we put back four" versus "we put back six"
     is a discrepancy somebody has to explain at the next count. */
  const p = plan({ replacements: [{ id: 'r1', name: 'Adrenaline', concentration: '1mg', qty: 6, expiry: '2027-01-01' }] });
  assert.throws(() => run([cart()], [], p), /exceed the approved Crash Cart standard quantity 4/);
});

test('a replacement quantity with no expiry is refused', () => {
  const p = plan({ replacements: [{ id: 'r1', name: 'Adrenaline', concentration: '1mg', qty: 2, expiry: '' }] });
  assert.throws(() => run([cart()], [], p), /requires an expiry date/);
});

test('a full open-and-replace leaves the cart complete, resealed and recorded', () => {
  const { carts, reports } = run([cart()], [], plan());
  const changed = carts[0].items[0];
  assert.equal(changed.present, 4);
  assert.equal(changed.stockStatus, 'available');
  assert.deepEqual(changed.batches.map((b) => b.expiry), ['2027-01-01'], 'the emptied batch is gone, the new one is there');
  assert.equal(carts[0].seal, 'S-200');
  assert.equal(reports.length, 1);
  assert.deepEqual(
    { old: reports[0].oldSeal, seal: reports[0].newSeal, removed: reports[0].removedQty, status: reports[0].status },
    { old: 'S-100', seal: 'S-200', removed: 4, status: 'closed' },
  );
  assert.equal(reports[0].openedBy, 'Ali');
  assert.equal(reports[0].openingLog, true, 'a bulk opening is still an opening in the log');
});

test('nothing is written by the engine itself — the originals are untouched', () => {
  const original = [cart()];
  const before = JSON.stringify(original);
  run(original, [], plan());
  assert.equal(JSON.stringify(original), before, 'a refusal costs nothing and a partial failure is impossible');
});

test('a seal already used anywhere is refused, including on an old report', () => {
  assert.throws(() => run([cart()], [], plan({ cartPlans: [{ cartId: 'c1', newSeal: 'S-100', removeQty: 1, replacements: {} }] })), /already used/);
  const reports = [{ id: 'r', cartId: 'c9', status: 'closed', oldSeal: 'S-050', newSeal: 'S-300' }];
  assert.throws(() => run([cart()], reports, plan({ cartPlans: [{ cartId: 'c1', newSeal: 'S-300', removeQty: 1, replacements: {} }] })), /already used/);
  assert.throws(() => run([cart()], reports, plan({ cartPlans: [{ cartId: 'c1', newSeal: 'S-050', removeQty: 1, replacements: {} }] })), /already used/);
});

test('two carts in one plan cannot be given the same new seal', () => {
  const carts = [cart(), cart({ id: 'c2', name: 'ER cart', seal: 'S-101' })];
  const p = plan({ cartPlans: [
    { cartId: 'c1', newSeal: 'S-777', removeQty: 1, replacements: {} },
    { cartId: 'c2', newSeal: 'S-777', removeQty: 1, replacements: {} },
  ] });
  assert.throws(() => run(carts, [], p), /already used/);
});

test('every seal is checked before any cart is touched', () => {
  /* A plan that fails halfway must not leave one cart opened and the next not. */
  const carts = [cart(), cart({ id: 'c2', name: 'ER cart', seal: 'S-101' })];
  const p = plan({ cartPlans: [
    { cartId: 'c1', newSeal: 'S-777', removeQty: 1, replacements: {} },
    { cartId: 'c2', newSeal: '', removeQty: 1, replacements: {} },
  ] });
  assert.throws(() => run(carts, [], p), /unique new seal is required/);
});

test('a cart with an open report is refused rather than opened twice', () => {
  const reports = [{ id: 'open-1', cartId: 'c1', status: 'open' }];
  assert.throws(() => run([cart()], reports, plan()), /already has an open report/);
  const pending = [{ id: 'p-1', cartId: 'c1', status: 'pending' }];
  assert.throws(() => run([cart()], pending, plan()), /already has an open report/);
});

test('a seal that fails the hospital\'s own format rule is refused', () => {
  const p = plan({ cartPlans: [{ cartId: 'c1', newSeal: 'S1', removeQty: 1, replacements: {} }] });
  assert.throws(() => run([cart()], [], p), /valid seal number/);
});

test('removing more than a chosen expiry holds is refused', () => {
  const target = item();
  assert.throws(() => removeFromItem(target, '2026-06-01', 9), /Selected expiry has insufficient quantity/);
  assert.throws(() => removeFromItem(item(), '', 9), /Cart has insufficient available quantity/);
});

test('removing zero means removing all of it', () => {
  const wholeItem = item();
  assert.equal(removeFromItem(wholeItem, '', 0), 4);
  assert.equal(wholeItem.present, 0);
  assert.equal(wholeItem.stockStatus, 'out_of_stock');

  const oneExpiry = item({ present: 6, qty: 6, batches: [{ expiry: '2026-06-01', qty: 4 }, { expiry: '2027-01-01', qty: 2 }] });
  assert.equal(removeFromItem(oneExpiry, '2026-06-01', 0), 4, 'all of THAT expiry, not the whole item');
  assert.equal(oneExpiry.present, 2);
  assert.equal(oneExpiry.stockStatus, 'partial');
});

test('a cart does not grow a dead batch row with every opening', () => {
  /* The cart is one Firestore document. What was removed is recorded on the
     opening report, so a zero row left behind in the cart adds nothing and
     grows the document for the life of the cart. */
  const target = item({ batches: [{ expiry: '2026-06-01', qty: 4, lot: 'L1' }] });
  removeFromItem(target, '2026-06-01', 4);
  assert.deepEqual(target.batches, []);

  // A batch that was ALREADY empty before this removal is not this operation's
  // business and is left exactly as it was.
  const mixed = item({ present: 4, batches: [{ expiry: '2025-01-01', qty: 0, lot: 'old' }, { expiry: '2026-06-01', qty: 4 }] });
  removeFromItem(mixed, '2026-06-01', 4);
  assert.deepEqual(mixed.batches.map((b) => b.lot), ['old']);
});

test('a medicine the cart never held cannot be slipped in with a quantity', () => {
  /* It is added with a standard of zero, so any quantity exceeds it: putting an
     unapproved medicine into a crash cart belongs to whoever sets the standard. */
  const p = plan({ replacements: [{ id: 'r1', name: 'Something New', concentration: '5mg', qty: 1, expiry: '2027-01-01' }] });
  assert.throws(() => run([cart()], [], p), /exceed the approved Crash Cart standard quantity 0/);
});

test('a replacement excluded for one cart is not recorded for it', () => {
  const carts = [cart(), cart({ id: 'c2', name: 'ER cart', seal: 'S-101' })];
  const p = plan({ cartPlans: [
    { cartId: 'c1', newSeal: 'S-777', removeQty: 4, replacements: { r1: { include: true } } },
    { cartId: 'c2', newSeal: 'S-888', removeQty: 4, replacements: { r1: { include: false } } },
  ] });
  const { carts: next, reports } = run(carts, [], p);
  assert.equal(reports[0].replacements.length, 1);
  assert.equal(reports[1].replacements.length, 0);
  assert.equal(next[1].items[0].present, 0, 'that cart was emptied and not refilled');
});

test('one cart may use a different expiry from the rest of the plan', () => {
  const carts = [cart(), cart({ id: 'c2', name: 'ER cart', seal: 'S-101' })];
  const p = plan({ cartPlans: [
    { cartId: 'c1', newSeal: 'S-777', removeQty: 4, replacements: { r1: { include: true } } },
    { cartId: 'c2', newSeal: 'S-888', removeQty: 4, replacements: { r1: { include: true, expiryOverride: '2028-05-05' } } },
  ] });
  const { carts: next, reports } = run(carts, [], p);
  assert.deepEqual(next[0].items[0].batches.map((b) => b.expiry), ['2027-01-01']);
  assert.deepEqual(next[1].items[0].batches.map((b) => b.expiry), ['2028-05-05']);
  assert.equal(reports[1].replacements[0].expiry, '2028-05-05', 'and the record says which was used');
});

test('a medicine is identified by id when it has one, by name and strength when it does not', () => {
  assert.equal(itemKey({ medId: 'm1', name: 'x' }, normalize), 'id:m1');
  assert.equal(itemKey({ name: 'Adrenaline', concentration: '1mg' }, normalize), 'name:adrenaline|1mg');
  assert.equal(itemKey({ name: 'Adrenaline', strength: '1mg' }, normalize), 'name:adrenaline|1mg');
});

test('a source medicine missing from one cart stops the whole plan', () => {
  const carts = [cart(), cart({ id: 'c2', name: 'ER cart', seal: 'S-101', items: [] })];
  const p = plan({ cartPlans: [
    { cartId: 'c1', newSeal: 'S-777', removeQty: 1, replacements: {} },
    { cartId: 'c2', newSeal: 'S-888', removeQty: 1, replacements: {} },
  ] });
  assert.throws(() => run(carts, [], p), /Source medicine not found in ER cart/);
});

test('seals already in use are collected from both carts and reports', () => {
  const used = usedSeals([{ seal: ' S-1 ' }], [{ oldSeal: 'S-2', newSeal: 'S-3' }]);
  assert.deepEqual(Object.keys(used).sort(), ['s-1', 's-2', 's-3']);
});

test('a replacement onto an item that already holds some tops it up', () => {
  const target = item({ qty: 6, present: 2, batches: [{ expiry: '2026-06-01', qty: 2 }] });
  addReplacement(target, { qty: 4, lot: 'L2' }, '2027-01-01', () => 'b2');
  assert.equal(target.present, 6);
  assert.equal(target.stockStatus, 'available');
  assert.equal(target.batches.length, 2);
});
