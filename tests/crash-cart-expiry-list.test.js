import test from 'node:test';
import assert from 'node:assert/strict';
import { crashCartExpiryList, parseWindowDays, expiringRows, unavailableRows } from '../public/assets/js/core/crash-cart-expiry-list.js';
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
  assert.equal(list.summary.totalAdd, 0);
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
  assert.match(html, /class="seal"/);
  for (const heading of ['Crash cart', 'Generic name', 'Near-expiry qty', 'Expiry date', 'New seal number']) assert.match(html, new RegExp(heading));
  assert.doesNotMatch(html, /facility|logo|<img/i);
  assert.match(html, /<tfoot>/);
  assert.equal((listTable(crashCartExpiryList(carts, 60, daysUntil)).match(/<tr class=/g) || []).length, 1);
});

test('a cart below its standard is short by the difference; none recorded means short by the whole standard; unrecorded is no shortage', () => {
  const carts = [{ id: 'c', name: 'ICU', items: [
    item('Adenosine', [], { qty: 6, present: 0 }),
    item('Atropine', [{ expiry: '2028-01-01', qty: 1 }], { qty: 2, present: 1 }),
    item('Dopamine', [{ expiry: '2026-11-05', qty: 3 }], { qty: 3, present: 0 }),
    item('Full', [{ expiry: '2028-01-01', qty: 4 }], { qty: 4, present: 4 }),
    { name: 'Unrecorded', qty: 3, batches: [] },
  ] }];
  const list = crashCartExpiryList(carts, 60, daysUntil);
  assert.deepEqual(unavailableRows(carts).map((r) => [r.generic, r.standard, r.present, r.shortage]),
    [['Adenosine', 6, 0, 6], ['Atropine', 2, 1, 1], ['Dopamine', 3, 0, 3]]);
  assert.equal(list.rows.length, 0, 'stale batches on an item that is empty produce no expiry row');
  assert.equal(list.summary.missingRows, 3);
  assert.equal(list.summary.totalAdd, 10);
});

test('a cart out of a medicine gets the mark of that medicine, takes no row of its own, and the summary explains the mark', () => {
  const carts = [
    { id: 'a', name: 'Cart A', items: [item('Atropine', [{ expiry: '2026-11-09', qty: 2 }]), item('Adenosine', [], { qty: 6, present: 0 }), item('Dopamine', [], { qty: 3, present: 0 })] },
    { id: 'b', name: 'Cart B', items: [item('Atropine', [{ expiry: '2026-11-12', qty: 1 }]), item('Adenosine', [], { qty: 6, present: 0 })] },
    { id: 'c', name: 'Cart C', items: [item('Dopamine', [], { qty: 3, present: 0 })] },
  ];
  const list = crashCartExpiryList(carts, 60, daysUntil);
  assert.deepEqual(list.groups.map((g) => g.cartName), ['Cart A', 'Cart B'], 'a cart with only a shortage has no row');
  assert.equal(list.rows.length, 2);
  const mark = (name) => list.summary.medicines.find((m) => m.generic === name).mark;
  assert.equal(new Set([mark('Adenosine'), mark('Dopamine')]).size, 2, 'each missing medicine has its own mark');
  assert.equal(mark('Atropine'), '', 'a medicine nobody is out of has no mark');
  assert.deepEqual(list.groups[0].marks, [mark('Adenosine'), mark('Dopamine')].sort(), 'two shortages, two marks');
  assert.deepEqual(list.groups[1].marks, [mark('Adenosine')]);
  const dopamine = list.summary.medicines.find((m) => m.generic === 'Dopamine');
  assert.deepEqual(dopamine.outIn.map((c) => c.cartName), ['Cart A', 'Cart C'], 'Cart C is named in the summary although it has no row');
  const html = sheetHtml(list, '2026-11-01');
  assert.equal(dopamine.addQty, 6, 'standard 3, none present, in each of two carts');
  assert.match(html, /<b class="mk">[^<]+<\/b> Dopamine/, 'the mark sits beside the name in the same cell');
  assert.match(html, /ينضاف 6 في 2 عربة/);
  assert.doesNotMatch(html, /Cart C/, 'no cart names or details for shortages in the summary');
  assert.doesNotMatch(html, /غير متوفر بالكراش/, 'no per-medicine row for shortages');
});

test('the sheet has one merged seal cell per cart and alternating shading by cart', () => {
  const carts = [
    { id: 'a', name: 'Cart A', items: [item('Atropine', [{ expiry: '2026-11-09', qty: 2 }]), item('Zinc', [{ expiry: '2026-11-10', qty: 1 }])] },
    { id: 'b', name: 'Cart B', items: [item('Zinc', [{ expiry: '2026-11-12', qty: 1 }])] },
    { id: 'c', name: 'Cart C', items: [item('Dopamine', [{ expiry: '2026-11-12', qty: 1 }])] },
  ];
  const html = sheetHtml(crashCartExpiryList(carts, 60, daysUntil), '2026-11-01');
  assert.equal((html.match(/class="seal"/g) || []).length, 3, 'one seal cell per cart, not per medicine');
  assert.equal((html.match(/class="cart"/g) || []).length, 3, 'the cart name is written once per cart');
  assert.match(html, /dir="ltr"/);
  assert.match(html, /h1\{[^}]*text-align:center/);
  assert.match(html, /class="seal" rowspan="2"/);
  assert.deepEqual([...html.matchAll(/<tr class="([gw])">/g)].map((m) => m[1]), ['g', 'g', 'w', 'g']);
  assert.match(html, /print-color-adjust:exact/);
  assert.match(html, /name="viewport"/);
});

test('a window with only shortages still prints the summary', () => {
  const carts = [{ id: 'a', name: 'Cart A', items: [item('Adenosine', [], { qty: 6, present: 0 })] }];
  const list = crashCartExpiryList(carts, 60, daysUntil);
  assert.equal(list.groups.length, 0);
  const html = sheetHtml(list, '2026-11-01');
  assert.match(html, /Adenosine/);
  assert.match(html, /<b>6<\/b>/, 'the standard is what must be added');
});

test('every pharmacy-side role and the Master can use it; departments and others cannot', () => {
  for (const role of ['pharmacy', 'inpatient_supervisor', 'outpatient_pharmacy_supervisor', 'pharmacy_staff']) {
    assert.equal(hasCapability({ role }, 'crashCart.operate'), true, role);
  }
  assert.equal(hasCapability({ role: 'pharmacy_staff' }, 'crashCart.operate'), true);
  for (const role of ['department', 'warehouse', 'controlled_pharmacy']) assert.equal(hasCapability({ role }, 'crashCart.operate'), false, role);
});

test('the worked example: standard 2, one cart holds 1 -> that cart is marked and 1 is added', () => {
  const carts = [
    { id: 'a', name: 'Cart A', items: [item('Atropine', [{ expiry: '2026-11-09', qty: 1 }], { qty: 2, present: 1 })] },
    { id: 'b', name: 'Cart B', items: [item('Atropine', [{ expiry: '2026-11-12', qty: 1 }], { qty: 2, present: 2 })] },
  ];
  const list = crashCartExpiryList(carts, 60, daysUntil);
  const [atropine] = list.summary.medicines;
  assert.deepEqual([atropine.addQty, atropine.missingCarts, atropine.qty], [1, 1, 2]);
  assert.deepEqual(list.groups.map((g) => [g.cartName, g.marks.length]), [['Cart A', 1], ['Cart B', 0]], 'only the short cart carries the mark');
  const html = sheetHtml(list, '2026-11-01');
  assert.match(html, /<b>3<\/b>/, '2 near-expiry units + 1 to add');
  assert.match(html, /ينضاف 1 في 1 عربة/);
});
