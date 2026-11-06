import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  newId, normalizeDoc, normalizeItem, validateDraft, missingRequired, daysUntil, alertConfig, expiryStatus, itemExpiry,
  filterItems, summarize, assignCabinet, printSections,
  buildRows, readSheet, applyImport, COLUMNS, MAX_ITEMS,
} from '../public/assets/js/core/medical-supplies-model.js';

const TODAY = new Date(2026, 10, 5); // 5 Nov 2026, local
const none = { required: { expiry: false, batch: false, quantity: false } };
const draft = (extra) => Object.assign({ id: '', name: 'Gauze 10x10', code: 'G-10', batches: [] }, extra);

test('ids are safe Firestore field names and never repeat, even within one millisecond', () => {
  const ids = new Set();
  for (let i = 0; i < 3000; i += 1) ids.add(newId('i', Math.random, () => 1700000000000));
  assert.equal(ids.size, 3000);
  ids.forEach((id) => assert.match(id, /^i_[a-z0-9]+$/));
});

test('name and code are always required; everything else is optional by default', () => {
  assert.equal(validateDraft(draft(), none, []).ok, true);
  const noName = validateDraft(draft({ name: '  ' }), none, []);
  assert.equal(noName.ok, false);
  assert.deepEqual(noName.errors.map((e) => e.field), ['name']);
  const noCode = validateDraft(draft({ code: '' }), none, []);
  assert.deepEqual(noCode.errors.map((e) => e.field), ['code']);
  assert.equal(noCode.item, null, 'an invalid draft yields no record to save');
});

test('a code identifies one item inside a department, whatever digits or case it was typed in', () => {
  const others = [{ id: 'i_1', name: 'Gloves M', code: 'ab-12', batches: [] }];
  const clash = validateDraft(draft({ code: 'AB-12' }), none, others);
  assert.equal(clash.ok, false);
  assert.match(clash.errors[0].text, /Gloves M/);
  assert.equal(validateDraft(draft({ id: 'i_1', code: 'AB-12', name: 'Gloves M' }), none, others).ok, true, 'editing the item itself is not a clash');
  assert.equal(validateDraft(draft({ code: '١٢٣' }), none, [{ id: 'x', name: 'N', code: '123', batches: [] }]).ok, false, 'Arabic-Indic digits match Western ones');
});

test('each department decides which of expiry, batch and quantity it requires', () => {
  const needExpiry = { required: { expiry: true, batch: false, quantity: false } };
  const empty = validateDraft(draft(), needExpiry, []);
  assert.equal(empty.ok, false, 'requiring a field means the item needs a batch row to hold it');
  assert.deepEqual(empty.errors.map((e) => e.field), ['expiry']);

  const dated = validateDraft(draft({ batches: [{ expiry: '2027-03-01', qty: '', batch: '' }] }), needExpiry, []);
  assert.equal(dated.ok, true);
  assert.equal(dated.item.batches[0].qty, null, 'optional fields stay empty rather than becoming 0');

  const all = { required: { expiry: true, batch: true, quantity: true } };
  const partial = validateDraft(draft({ batches: [{ expiry: '2027-03-01', batch: 'L1', qty: '' }] }), all, []);
  assert.deepEqual(partial.errors.map((e) => e.field), ['quantity']);
  assert.equal(validateDraft(draft({ batches: [{ expiry: '2027-03-01', batch: 'L1', qty: '0' }] }), all, []).ok, true, 'zero is a quantity');
});

test('a completely blank batch row is ignored, a half-filled bad one is an error', () => {
  const blank = validateDraft(draft({ batches: [{ expiry: '', qty: '', batch: '' }] }), none, []);
  assert.equal(blank.ok, true);
  assert.equal(blank.item.batches.length, 0);
  assert.equal(validateDraft(draft({ batches: [{ expiry: '2027-02-30', qty: '', batch: '' }] }), none, []).ok, false, '30 February does not exist');
  assert.equal(validateDraft(draft({ batches: [{ expiry: '', qty: '-1', batch: '' }] }), none, []).ok, false);
  assert.equal(validateDraft(draft({ batches: [{ expiry: '', qty: 'abc', batch: '' }] }), none, []).ok, false);
  assert.equal(validateDraft(draft({ batches: [{ expiry: '15/03/2027', qty: '5', batch: 'B' }] }), none, []).item.batches[0].expiry, '2027-03-15', 'day first, as in the Excel reader');
});

test('missingRequired reports what an existing item lacks, for the "incomplete" mark', () => {
  const all = { required: { expiry: true, batch: true, quantity: true } };
  assert.deepEqual(missingRequired({ batches: [] }, none), []);
  assert.deepEqual(missingRequired({ batches: [] }, all), ['expiry', 'batch', 'quantity']);
  assert.deepEqual(missingRequired({ batches: [{ expiry: '2027-01-01', batch: '', qty: 3 }] }, all), ['batch']);
});

test('days to expiry is a calendar difference and the alert settings keep early past urgent', () => {
  assert.equal(daysUntil('2026-11-05', TODAY), 0);
  assert.equal(daysUntil('2026-11-04', TODAY), -1);
  assert.equal(daysUntil('2026-12-05', TODAY), 30);
  assert.equal(daysUntil('', TODAY), null);
  assert.deepEqual(alertConfig(undefined), { d1: 30, d2: 7 });
  assert.deepEqual(alertConfig({ d1: 5, d2: 10 }), { d1: 11, d2: 10 }, 'early can never be at or below urgent');
});

test('expiry status uses the department alert days: expired, urgent, near, ok, none', () => {
  const cfg = { d1: 30, d2: 7 };
  assert.equal(expiryStatus(-1, cfg), 'expired');
  assert.equal(expiryStatus(0, cfg), 'urgent');
  assert.equal(expiryStatus(7, cfg), 'urgent');
  assert.equal(expiryStatus(8, cfg), 'near');
  assert.equal(expiryStatus(30, cfg), 'near');
  assert.equal(expiryStatus(31, cfg), 'ok');
  assert.equal(expiryStatus(null, cfg), 'none');
});

test('an item with several batches is as urgent as its worst dated batch', () => {
  const item = normalizeItem({ id: 'i', name: 'A', code: 'a', batches: [
    { id: 'b1', expiry: '2027-09-01' }, { id: 'b2', expiry: '2026-11-10' }, { id: 'b3', expiry: '' },
  ] });
  const exp = itemExpiry(item, { d1: 30, d2: 7 }, TODAY);
  assert.equal(exp.status, 'urgent', '5 days is inside the 7-day urgent window');
  assert.equal(exp.days, 5);
  assert.deepEqual(exp.batches.map((b) => b.id), ['b2', 'b1', 'b3'], 'soonest first, undated last');
});

const sample = () => {
  const refs = { groups: new Set(['g1']), cabinets: new Set(['c1', 'c2']) };
  return [
    normalizeItem({ id: 'i1', name: 'Syringe 5ml', code: 'S5', groupId: 'g1', cabinetIds: ['c1'], batches: [{ id: 'b1', expiry: '2026-11-01', batch: 'L1', qty: 10 }] }, refs),
    normalizeItem({ id: 'i2', name: 'Gauze', code: 'G1', cabinetIds: ['c1', 'c2'], batches: [{ id: 'b2', expiry: '2026-11-09' }] }, refs),
    normalizeItem({ id: 'i3', name: 'Gloves', code: 'GL', outOfStock: true, batches: [{ id: 'b3', expiry: '2027-12-01' }] }, refs),
    normalizeItem({ id: 'i4', name: 'Tape', code: 'T9', batches: [] }, refs),
  ];
};
const ctx = { cfg: { d1: 30, d2: 7 }, settings: { required: { expiry: true, batch: false, quantity: false } }, today: TODAY };

test('filters combine search, group, cabinet and expiry status', () => {
  const items = sample();
  const ids = (f) => filterItems(items, f, ctx).map((i) => i.id);
  assert.deepEqual(ids({ q: 'GAU' }), ['i2'], 'matches the name, case-insensitively');
  assert.deepEqual(ids({ q: 'gl' }), ['i3'], 'matches the code');
  assert.deepEqual(ids({ q: 'l1' }), ['i1'], 'matches a batch number');
  assert.deepEqual(ids({ cabinetId: 'c1' }), ['i1', 'i2']);
  assert.deepEqual(ids({ cabinetId: '__none__' }), ['i3', 'i4']);
  assert.deepEqual(ids({ groupId: '__none__' }), ['i2', 'i3', 'i4']);
  assert.deepEqual(ids({ status: 'expired' }), ['i1']);
  assert.deepEqual(ids({ status: 'urgent' }), ['i2']);
  assert.deepEqual(ids({ status: 'attention' }), ['i1', 'i2']);
  assert.deepEqual(ids({ status: 'noexpiry' }), ['i4']);
  assert.deepEqual(ids({ status: 'out' }), ['i3']);
  assert.deepEqual(ids({ status: 'incomplete' }), ['i4'], 'requires an expiry and has no batch row');
});

test('the summary counts each item once by its worst status', () => {
  assert.deepEqual(summarize(sample(), ctx), { total: 4, expired: 1, urgent: 1, near: 0, noExpiry: 1, out: 1, incomplete: 1, unassigned: 2 });
});

test('moving or adding to a cabinet follows the medicine drawers', () => {
  assert.deepEqual(assignCabinet({ cabinetIds: ['c1'] }, 'c2', 'move'), ['c2']);
  assert.deepEqual(assignCabinet({ cabinetIds: ['c1'] }, 'c2', 'add'), ['c1', 'c2']);
  assert.deepEqual(assignCabinet({ cabinetIds: ['c1'] }, 'c1', 'add'), ['c1']);
  assert.deepEqual(assignCabinet({ cabinetIds: ['c1', 'c2'] }, '__none__', 'add'), []);
});

test('a deleted cabinet or group never leaves an item pointing at it', () => {
  const doc = normalizeDoc({
    deptId: 'icu',
    groups: { g1: { name: 'Injections' } },
    cabinets: { c1: { name: 'Cabinet 1' } },
    items: { i1: { name: 'A', code: 'a', groupId: 'gone', cabinetIds: ['c1', 'gone'] } },
  });
  assert.equal(doc.items[0].groupId, '');
  assert.deepEqual(doc.items[0].cabinetIds, ['c1']);
  assert.deepEqual(doc.settings.required, { expiry: false, batch: false, quantity: false });
  assert.equal(normalizeDoc(null, 'icu').items.length, 0);
});

test('an item in two cabinets is printed under both; only one cabinet can be printed alone', () => {
  const items = sample();
  const cabinets = [{ id: 'c1', name: 'Cabinet 1', desc: '' }, { id: 'c2', name: 'Cabinet 2', desc: '' }];
  const sections = printSections(items, cabinets, [], {});
  assert.deepEqual(sections.map((s) => [s.id, s.items.map((i) => i.id)]), [['c1', ['i1', 'i2']], ['c2', ['i2']], ['__none__', ['i3', 'i4']]]);
  assert.deepEqual(printSections(items, cabinets, [], { only: 'c2' }).map((s) => s.id), ['c2']);
});

const col = (key) => COLUMNS.findIndex((c) => c.key === key);

test('re-importing an untouched export changes nothing', () => {
  const items = sample();
  const rows = buildRows(items, { daysUntil: () => 1 });
  assert.equal(rows.length, 1 + 4, 'one row per batch, plus one for the item with no batch');
  const read = readSheet(rows, { currentItems: items });
  assert.equal(read.ok, true, JSON.stringify(read.errors));
  assert.deepEqual(read.stats, { rows: 4, added: 0, updated: 0, unchanged: 4, expiries: 0 });
});

test('the import tells you what it would add and change, and never removes anything', () => {
  const items = sample();
  const rows = [
    ['Name / الاسم', 'Code / الكود', 'Expiry (YYYY-MM-DD) / تاريخ الانتهاء', 'Quantity (not imported)'],
    ['Syringe 5 ml', 's5', '2027-05-01', 999],        // renamed + a second expiry; quantity column is ignored
    ['Tape', 'T9', '15/06/2027', ''],                 // fills the item that had no date yet
    ['Cannula 20G', 'C20', 46000, ''],                // new item, Excel serial date
    ['Cannula 20G', 'c20', '2027-08-01', ''],         // same code again: a second expiry for the same new item
    ['', '', '', ''],                                  // blank row
  ];
  const read = readSheet(rows, { currentItems: items });
  assert.equal(read.ok, true, JSON.stringify(read.errors));
  assert.equal(read.plan.add.length, 1);
  assert.deepEqual(read.plan.add[0].expiries.length, 2);
  const syringe = read.plan.update.find((u) => u.id === 'i1');
  assert.equal(syringe.newName, 'Syringe 5 ml');
  assert.deepEqual(syringe.append, ['2027-05-01']);
  const tape = read.plan.update.find((u) => u.id === 'i4');
  assert.deepEqual(tape.append, ['2027-06-15'], 'an item with no batch row gets one');
  assert.equal(read.plan.update.length, 2, 'Gauze and Gloves are absent from the file and are left alone');

  const written = applyImport(items, read.plan, { now: '2026-11-05T10:00:00.000Z', by: 'ICU' });
  assert.equal(written.length, 3);
  const newSyringe = written.find((i) => i.id === 'i1');
  assert.equal(newSyringe.name, 'Syringe 5 ml');
  assert.equal(newSyringe.batches.length, 2);
  assert.equal(newSyringe.batches[0].qty, 10, 'the existing batch keeps its quantity');
  assert.equal(items[0].batches.length, 1, 'the source items are not mutated');
});

test('an existing batch row with no date takes the imported date instead of adding another', () => {
  const items = [normalizeItem({ id: 'i1', name: 'Tape', code: 'T9', batches: [{ id: 'b1', batch: 'X', qty: 4 }] })];
  const read = readSheet([['Name', 'Code', 'Expiry'], ['Tape', 'T9', '2027-01-02']], { currentItems: items });
  assert.deepEqual(read.plan.update[0].fill, [{ batchId: 'b1', expiry: '2027-01-02' }]);
  const out = applyImport(items, read.plan, {});
  assert.equal(out[0].batches.length, 1);
  assert.deepEqual([out[0].batches[0].batch, out[0].batches[0].qty, out[0].batches[0].expiry], ['X', 4, '2027-01-02']);
});

test('a bad row blocks the whole import instead of being guessed', () => {
  const read = readSheet([
    ['Name', 'Code', 'Expiry'],
    ['A', 'a1', 'soon'],
    ['', 'a2', ''],
    ['B', '', ''],
    ['C', 'c1', ''], ['D', 'C1', ''],
  ], { currentItems: [] });
  assert.equal(read.ok, false);
  assert.equal(read.errors.length, 4);
  assert.ok(read.errors.some((e) => /two different names/.test(e.text)));
});

test('a sheet without name and code columns is refused, and Arabic headers are understood', () => {
  assert.equal(readSheet([['Foo', 'Bar'], ['1', '2']], { currentItems: [] }).ok, false);
  const arabic = readSheet([['الاسم', 'الكود', 'تاريخ الانتهاء'], ['شاش', '77', '2027-01-01']], { currentItems: [] });
  assert.equal(arabic.ok, true);
  assert.equal(arabic.plan.add[0].code, '77');
});

test('a numeric code cell is read as the same text a person would type', () => {
  const items = [normalizeItem({ id: 'i1', name: 'Tape', code: '1001', batches: [] })];
  const read = readSheet([['Name', 'Code'], ['Tape', 1001]], { currentItems: items });
  assert.equal(read.stats.unchanged, 1);
});

test('the import cannot take a department past the document size ceiling', () => {
  const current = Array.from({ length: MAX_ITEMS }, (_, n) => normalizeItem({ id: `i${n}`, name: `N${n}`, code: `C${n}`, batches: [] }));
  const read = readSheet([['Name', 'Code'], ['One more', 'NEW']], { currentItems: current });
  assert.equal(read.ok, false);
  assert.match(read.errors[0].text, new RegExp(String(MAX_ITEMS)));
});

test('only name, code and expiry are imported columns', () => {
  assert.deepEqual(COLUMNS.filter((c) => c.imported).map((c) => c.key), ['name', 'code', 'expiry']);
  assert.equal(col('expiry'), 2);
});
