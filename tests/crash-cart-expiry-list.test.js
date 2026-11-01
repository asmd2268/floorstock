import test from 'node:test';
import assert from 'node:assert/strict';
import { crashCartExpiryList, parseWindowDays, expiringRows } from '../public/assets/js/core/crash-cart-expiry-list.js';
import { sheetHtml, listTable } from '../public/assets/js/core/crash-cart-expiry-sheet.js';
import { hasCapability } from '../public/assets/js/core/role-capabilities.js';

/* "today" is 2026-11-01 for every test. */
const TODAY = Date.UTC(2026, 10, 1);
const daysUntil = (value) => Math.round((Date.parse(String(value).slice(0, 10) + 'T00:00:00Z') - TODAY) / 86400000);
const item = (generic, batches, extra = {}) => ({ name: generic, genericName: generic, qty: 4, present: 4, batches, ...extra });

test('a window is whole days between 1 and the maximum, anything else is rejected', () => {
  assert.equal(parseWindowDays('60'), 60);
  assert.equal(parseWindowDays(' 90 '), 90);
  for (const bad of ['', '0', '-5', '2.5', 'abc', '731', null, undefined]) assert.equal(parseWindowDays(bad), null, String(bad));
});

test('only batches inside the window are listed, expired ones included and flagged', () => {
  const carts = [{ id: 'c1', name: 'Cart 1', items: [item('Calcium Gluconate', [
    { expiry: '2026-11-20', qty: 2 }, { expiry: '2027-03-01', qty: 2 }, { expiry: '2026-10-25', qty: 1 },
  ])] }];
  const { rows } = crashCartExpiryList(carts, 60, daysUntil);
  assert.deepEqual(rows.map((r) => [r.expiry, r.qty, r.expired]), [['2026-10-25', 1, true], ['2026-11-20', 2, false]]);
});

test('batches of one medicine expiring the same day are one row', () => {
  const carts = [{ id: 'c1', name: 'A', items: [item('Atropine', [{ expiry: '2026-11-10', qty: 1 }, { expiry: '2026-11-10', qty: 2 }])] }];
  assert.deepEqual(expiringRows(carts, 60, daysUntil).map((r) => r.qty), [3]);
});

test('two medicines near expiry in one cart are two rows; rows sort by cart then date', () => {
  const carts = [
    { id: 'b', name: 'Cart 10', items: [item('Adenosine', [{ expiry: '2026-11-05', qty: 1 }])] },
    { id: 'a', name: 'Cart 2', items: [item('Zinc', [{ expiry: '2026-12-01', qty: 1 }]), item('Atropine', [{ expiry: '2026-11-09', qty: 2 }])] },
  ];
  assert.deepEqual(expiringRows(carts, 60, daysUntil).map((r) => [r.cartName, r.generic]),
    [['Cart 2', 'Atropine'], ['Cart 2', 'Zinc'], ['Cart 10', 'Adenosine']]);
});

test('the summary reproduces the worked example: four carts, 2+2+2+1 = 7 to replace', () => {
  const cartWith = (id, qty) => ({ id, name: 'Cart ' + id, items: [item('Calcium Gluconate', [{ expiry: '2026-11-15', qty }])] });
  const list = crashCartExpiryList([cartWith(1, 1), cartWith(2, 2), cartWith(3, 2), cartWith(4, 2)], 60, daysUntil);
  const [calcium] = list.summary.medicines;
  assert.deepEqual([calcium.generic, calcium.carts, calcium.qty], ['Calcium Gluconate', 4, 7]);
  assert.equal(list.summary.totalQty, 7);
});

test('different strengths of one generic are separate summary lines', () => {
  const carts = [{ id: 'c', name: 'C', items: [
    item('Dextrose', [{ expiry: '2026-11-10', qty: 1 }], { strength: '10%' }),
    item('Dextrose', [{ expiry: '2026-11-10', qty: 1 }], { strength: '50%' }),
  ] }];
  assert.equal(crashCartExpiryList(carts, 60, daysUntil).summary.medicines.length, 2);
});

test('an unrecorded batch quantity: inferred when alone, uncounted when ambiguous, zero rows dropped', () => {
  const alone = [{ id: 'c', name: 'C', items: [item('X', [{ expiry: '2026-11-10', qty: null }], { present: 3 })] }];
  assert.equal(expiringRows(alone, 60, daysUntil)[0].qty, 3);
  const two = [{ id: 'c', name: 'C', items: [item('X', [{ expiry: '2026-11-10', qty: null }, { expiry: '2026-11-12', qty: null }], { present: 4 })] }];
  const list = crashCartExpiryList(two, 60, daysUntil);
  assert.deepEqual(list.rows.map((r) => r.qty), [null, null]);
  assert.deepEqual([list.summary.totalQty, list.summary.uncountedRows], [0, 2]);
  const zero = [{ id: 'c', name: 'C', items: [item('X', [{ expiry: '2026-11-10', qty: 0 }])] }];
  assert.equal(expiringRows(zero, 60, daysUntil).length, 0);
});

test('a batch with no usable date is never listed', () => {
  const carts = [{ id: 'c', name: 'C', items: [item('X', [{ expiry: '', qty: 2 }, { expiry: 'garbage', qty: 2 }])] }];
  assert.equal(expiringRows(carts, 60, (v) => (v === 'garbage' ? null : daysUntil(v))).length, 0);
});

test('the printed sheet has the five columns, a blank seal cell per row, no letterhead, and escapes names', () => {
  const carts = [{ id: 'c', name: '<img src=x onerror=alert(1)>', items: [item('Atropine', [{ expiry: '2026-11-10', qty: 2 }])] }];
  const html = sheetHtml(crashCartExpiryList(carts, 60, daysUntil), '2026-11-01');
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /<td class="seal"><\/td>/);
  for (const heading of ['Crash cart', 'Generic name', 'Near-expiry qty', 'Expiry date', 'New seal number']) assert.match(html, new RegExp(heading));
  assert.doesNotMatch(html, /facility|logo|<img/i);
  assert.match(html, /<tfoot>/);
  assert.equal((listTable(crashCartExpiryList(carts, 60, daysUntil)).match(/<tr>/g) || []).length, 2);
});

test('every pharmacy-side role and the Master can use it; departments and others cannot', () => {
  for (const role of ['pharmacy', 'inpatient_supervisor', 'outpatient_pharmacy_supervisor', 'pharmacy_staff']) {
    assert.equal(hasCapability({ role }, 'crashCart.operate'), true, role);
  }
  assert.equal(hasCapability({ role: 'pharmacy_staff' }, 'crashCart.operate'), true);
  for (const role of ['department', 'warehouse', 'controlled_pharmacy']) assert.equal(hasCapability({ role }, 'crashCart.operate'), false, role);
});
