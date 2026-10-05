import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRows, readSheet, applyPlan, normalizeDate, normalizeNumber, dateToSerial, headerKey, COLUMNS } from '../public/assets/js/core/crash-cart-excel.js';
import { hasCapability } from '../public/assets/js/core/role-capabilities.js';

const carts = () => [
  { id: 'c1', name: 'ER Cart', deptId: 'er', seal: 'S-100', updatedAt: '2026-09-01T10:00:00.000Z', items: [
    { id: 'i1', name: 'Atropine', strength: '1 mg', qty: 10, present: 10, batches: [{ expiry: '2026-12-01', qty: 6, lot: 'A' }, { expiry: '2027-03-01', qty: 4, lot: 'B' }] },
    { id: 'i2', name: 'Adrenaline', strength: '1 mg/ml', qty: 5, present: 0, batches: [] }
  ] },
  { id: 'c2', name: 'ICU Cart', deptId: 'icu', seal: 'S-200', updatedAt: '', items: [
    { id: 'i3', name: 'Amiodarone', strength: '150 mg', qty: 2, present: 2, batches: [{ expiry: '2027-01-15', qty: 2, lot: '' }] }
  ] }
];
/* The sheet as Excel hands it back: header row, then values (dates as serials). */
const sheet = (list) => buildRows(list || carts(), { deptName: (d) => d.toUpperCase(), daysUntil: () => 99 }).map((row, i) => {
  if (i === 0) return row;
  const copy = row.slice();
  const e = dateToSerial(copy[7]);
  if (e !== null) copy[7] = e;
  return copy;
});
const col = (key) => COLUMNS.findIndex((c) => c.key === key);
const opts = (extra) => Object.assign({ currentCarts: carts(), blockedCartIds: [] }, extra);

test('an untouched backup restores to "no changes" and is valid', () => {
  const r = readSheet(sheet(), opts());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.stats.changedItems, 0);
});

test('every medicine appears, including one with no stock, and the header row matches the columns', () => {
  const rows = sheet();
  assert.equal(rows.length, 1 + 2 + 1 + 1);
  assert.ok(rows.some((r) => r[col('medicine')] === 'Adrenaline' && r[col('expiry')] === ''));
  assert.equal(headerKey('Cart ID - do not edit / معرّف العربة'), 'cart id');
  assert.equal(headerKey('Expiry (YYYY-MM-DD) / تاريخ الانتهاء'), 'expiry');
});

test('correcting a date back to an old one is read as a change, and applying it changes only that medicine', () => {
  const rows = sheet();
  rows[1][col('expiry')] = dateToSerial('2025-06-01'); // 2026-12-01 → an old date
  const r = readSheet(rows, opts());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.stats.changedItems, 1);
  assert.match(r.changes[0].lines[0], /2026-12-01.*→.*2025-06-01/);
  const next = applyPlan(carts(), r.plan, { name: 'Sup', user: 'sup' }, '2026-10-01T00:00:00.000Z');
  const atropine = next[0].items[0];
  assert.deepEqual(atropine.batches.map((b) => b.expiry).sort(), ['2025-06-01', '2027-03-01']);
  assert.equal(atropine.stockUpdatedBy, 'Sup');
  assert.deepEqual(next[0].items[1], carts()[0].items[1]);
  assert.deepEqual(next[1], carts()[1]);
  assert.equal(next[0].updatedBy, 'Sup');
});

test('dates typed in the ways people type them are all understood, and day comes first', () => {
  assert.equal(normalizeDate('2027-05-01').value, '2027-05-01');
  assert.equal(normalizeDate('2027/5/1').value, '2027-05-01');
  assert.equal(normalizeDate('03/04/2027').value, '2027-04-03');
  assert.equal(normalizeDate('٠١/٠٥/٢٠٢٧').value, '2027-05-01');
  assert.equal(normalizeDate(dateToSerial('2027-05-01')).value, '2027-05-01');
  assert.equal(normalizeDate('31/02/2027').ok, false);
  assert.equal(normalizeDate('soon').ok, false);
  assert.equal(normalizeDate('').blank, true);
  assert.equal(normalizeNumber('٥').value, 5);
  assert.equal(normalizeNumber('1,5').ok, false);
});

test('Arabic digits typed in a quantity cell are read as numbers', () => {
  const rows = sheet();
  rows[4][col('required')] = '٣'; rows[4][col('available')] = '٣'; rows[4][col('batchQty')] = '٣';
  const r = readSheet(rows, opts());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.changes[0].after.available, 3);
});

test('the contents-editor rules are enforced: nothing is applied while any row has an error', () => {
  const rows = sheet();
  rows[1][col('batchQty')] = 7; // 7 + 4 ≠ 10
  let r = readSheet(rows, opts());
  assert.equal(r.ok, false);
  assert.match(r.errors[0].message, /add up/);

  const over = sheet();
  over.slice(1, 3).forEach((row) => { row[col('available')] = 12; });
  r = readSheet(over, opts());
  assert.ok(r.errors.some((e) => /cannot exceed/.test(e.message)));

  const badDate = sheet();
  badDate[1][col('expiry')] = '99/99/2027';
  assert.ok(readSheet(badDate, opts()).errors.some((e) => /not valid/.test(e.message)));

  const mismatch = sheet();
  mismatch[2][col('required')] = 99;
  assert.ok(readSheet(mismatch, opts()).errors.some((e) => /differs between the rows/.test(e.message)));

  const zeroWithBatches = sheet();
  zeroWithBatches.slice(1, 3).forEach((row) => { row[col('available')] = 0; });
  assert.ok(readSheet(zeroWithBatches, opts()).errors.some((e) => /is 0 but batch rows/.test(e.message)));
});

test('a medicine can be given stock, and a batch can be added by copying a row', () => {
  const rows = sheet();
  const adrenaline = rows.findIndex((r) => r[col('medicine')] === 'Adrenaline');
  rows[adrenaline][col('available')] = 5;
  rows[adrenaline][col('expiry')] = dateToSerial('2027-08-01');
  rows[adrenaline][col('batchQty')] = 5;
  let r = readSheet(rows, opts());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const extra = rows[1].slice();
  extra[col('expiry')] = dateToSerial('2028-01-01'); extra[col('batchQty')] = 0;
  rows[1][col('batchQty')] = 3; rows[2][col('batchQty')] = 4; extra[col('batchQty')] = 3;
  rows.push(extra);
  r = readSheet(rows, opts());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.changes.find((c) => c.medicine === 'Atropine').after.batches.length, 3);
});

test('rows that are deleted never delete stock; unknown ids are refused', () => {
  const rows = sheet().filter((r, i) => i === 0 || r[col('medicine')] !== 'Atropine');
  const r = readSheet(rows, opts());
  assert.equal(r.ok, true);
  assert.equal(r.stats.changedItems, 0);

  const ghost = sheet();
  ghost[1][col('itemId')] = 'nope';
  assert.ok(readSheet(ghost, opts()).errors.some((e) => /not in cart/.test(e.message)));
  const noCart = sheet();
  noCart[1][col('cartId')] = 'zzz';
  assert.ok(readSheet(noCart, opts()).errors.some((e) => /does not exist/.test(e.message)));
  const blankIds = sheet();
  blankIds[1][col('cartId')] = '';
  assert.ok(readSheet(blankIds, opts()).errors.some((e) => /empty/.test(e.message)));
});

test('a cart changed after the export is skipped unless overwrite is chosen', () => {
  const rows = sheet();
  rows[1][col('expiry')] = dateToSerial('2025-06-01');
  const now = carts();
  now[0].updatedAt = '2026-09-20T09:00:00.000Z'; // someone edited it after the export
  let r = readSheet(rows, { currentCarts: now, blockedCartIds: [] });
  assert.equal(r.stats.changedItems, 0);
  assert.equal(r.skipped[0].reason, 'stale');
  r = readSheet(rows, { currentCarts: now, blockedCartIds: [], overwriteStale: true });
  assert.equal(r.stats.changedItems, 1);
});

test('a cart with an open report is skipped', () => {
  const rows = sheet();
  rows[1][col('expiry')] = dateToSerial('2025-06-01');
  const r = readSheet(rows, opts({ blockedCartIds: ['c1'] }));
  assert.equal(r.stats.changedItems, 0);
  assert.equal(r.skipped[0].reason, 'open-report');
});

test('the seal column is shown but never imported', () => {
  const rows = sheet();
  rows.slice(1).forEach((row) => { row[col('seal')] = 'HACKED'; });
  const r = readSheet(rows, opts());
  assert.equal(r.stats.changedItems, 0);
});

test('a file that is not a backup is refused cleanly', () => {
  const r = readSheet([['a', 'b'], [1, 2]], opts());
  assert.equal(r.ok, false);
  assert.match(r.errors[0].message, /not a Crash Cart backup/);
});

test('only the Inpatient Pharmacy Supervisor and the Master may use it', () => {
  assert.equal(hasCapability({ role: 'inpatient_supervisor' }, 'crashCart.backup'), true);
  assert.equal(hasCapability({ role: 'pharmacy', master: true }, 'crashCart.backup'), true);
  ['pharmacy', 'pharmacy_staff', 'outpatient_pharmacy_supervisor', 'department', 'warehouse', 'controlled_pharmacy'].forEach((role) => {
    assert.equal(hasCapability({ role }, 'crashCart.backup'), false, role);
  });
});

import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../public/assets/js/' + p, import.meta.url), 'utf8');

test('the crash cart print sheet and the department view follow the configured near-expiry days, not a fixed 30', () => {
  const print = read('modules/49-asdh-final-persistence-actions-20260725.js');
  assert.match(print, /var printRules=rules\(\);/);
  assert.match(print, /days<=printRules\.nearDays/);
  assert.doesNotMatch(print, /Near expiry 8–30 days/);
  assert.doesNotMatch(print, /Expiry within 30 days/);
  const dept = read('modules/38-v16-user-operations-main.js');
  assert.match(dept, /currentExpiryThresholds\(\)\.nearDays/);
  assert.doesNotMatch(dept, /d>=0&&d<=30/);
});

test('the Excel module is loaded by the app and gated by the capability, never by a role name', () => {
  const mod = read('modules/86-crash-cart-excel-backup.js');
  assert.match(mod, /fsHasCapability\('crashCart\.backup'\)/);
  assert.doesNotMatch(mod, /inpatient_supervisor|CU\.role/);
  assert.match(mod, /await exportNow\('FloorStock_CrashCarts_BEFORE_restore'\)/);
  assert.match(mod, /await window\.setCrashCarts\(working\)/);
  // The buttons belong to the page's own toolbar, not injected after the render.
  assert.doesNotMatch(mod, /__renderCrashCartsAfterExtensions|insertAdjacentElement|appendChild\(el\('div', \{ id: 'cc-excel-tools/);
  const page = read('modules/44-ccx-inventory-redesign-script.js');
  // The page module imports the two actions; they are not published as window globals.
  assert.match(page, /import \{ ccExcelBackup, ccExcelRestore \} from '\.\/86-crash-cart-excel-backup\.js/);
  assert.doesNotMatch(mod, /window\.ccExcel(Backup|Restore)\s*=/);
  assert.match(page, /id="ccx-excel-backup"/);
  assert.match(page, /id="ccx-excel-restore"/);
  assert.match(page, /fsHasCapability\('crashCart\.backup'\)/);
});

test('crashCarts() hands out a copy, so an editor can never change the cache it is later compared with', () => {
  /* Every trolley editor reads the trolleys, changes one in place and saves the
     whole list. Saving is by DIFF against the cache (core/row-merge-write.js);
     if the editor had changed the cached objects themselves, "before" and "after"
     were the same thing, the diff was empty and nothing was written — the screen
     showed the new expiry date, the server kept the old one, and the old date came
     back with the next snapshot. */
  const src = read('modules/07j-controlled-module-enhancements.js');
  const line = src.split('\n').find((l) => l.startsWith('function crashCarts()'));
  assert.ok(line, 'crashCarts() must exist');
  assert.match(line, /structuredClone\(rows\)/);
  assert.doesNotMatch(line, /return S\.g\('crash_carts'\)\|\|\[\]\}/);
});
