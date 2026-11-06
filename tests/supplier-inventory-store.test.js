import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildUpdate, toNewDocument, commit, docRef } from '../public/assets/js/core/supplier-inventory-store.js';
import { normalizeDoc } from '../public/assets/js/core/supplier-inventory-model.js';

const base = () => normalizeDoc({
  settings: { required: { expiry: false, batch: false, quantity: false } },
  groups: { g1: { name: 'Injections' } }, cabinets: { c1: { name: 'Cab 1' } },
  items: { i1: { name: 'A', code: 'a', batches: [] }, i2: { name: 'B', code: 'b', batches: [] } },
}, 'icu');
const clone = (x) => JSON.parse(JSON.stringify(x));

test('only the changed, added and removed rows become field writes', () => {
  const prev = base();
  const next = clone(prev);
  next.items[0].name = 'A2';
  next.items = next.items.filter((i) => i.id !== 'i2');
  next.items.push({ id: 'i3', name: 'C', code: 'c', groupId: '', cabinetIds: [], outOfStock: false, notes: '', batches: [], createdAt: '', updatedAt: '', updatedBy: '' });
  const diff = buildUpdate(prev, next);
  assert.deepEqual(Object.keys(diff.set).sort(), ['items.i1', 'items.i3']);
  assert.deepEqual(diff.remove, ['items.i2']);
  assert.equal('id' in diff.set['items.i1'], false, 'the id is the key, not a stored field');
  assert.equal(buildUpdate(prev, clone(prev)).empty, true);
});

test('settings are written only when they change', () => {
  const prev = base();
  const next = clone(prev);
  next.settings.required.expiry = true;
  assert.deepEqual(Object.keys(buildUpdate(prev, next).set), ['settings']);
});

test('tenant and legacy deployments use different paths', () => {
  const calls = [];
  const db = { collection: (n) => ({ doc: (d) => { calls.push(`${n}/${d}`); return { collection: (c) => ({ doc: (x) => { calls.push(`${c}/${x}`); return {}; } }) }; } }) };
  docRef(db, { tenantId: 't1' }, 'icu');
  docRef(db, {}, 'icu');
  assert.deepEqual(calls, ['tenants/t1', 'supplier_inventory/icu', 'supplier_inventory/icu']);
});

test('a first save creates the document when the update finds none', async () => {
  const log = [];
  const ref = { update: async () => { const e = new Error('x'); e.code = 'not-found'; throw e; }, set: async (d, o) => log.push([d, o]) };
  const db = { collection: () => ({ doc: () => ref }) };
  const next = base();
  await commit({ db, profile: {}, deptId: 'icu', fieldValue: { delete: () => 'DEL' }, prev: normalizeDoc(null, 'icu'), next, now: 'T' });
  assert.equal(log.length, 1);
  assert.deepEqual(log[0][1], { merge: true });
  assert.equal(log[0][0].items.i1.name, 'A');
  assert.equal(log[0][0].deptId, 'icu');
});

test('removals use the delete sentinel and nothing is sent when nothing changed', async () => {
  let sent = null;
  const ref = { update: async (f) => { sent = f; } };
  const db = { collection: () => ({ doc: () => ref }) };
  const prev = base();
  const next = clone(prev); next.items.pop();
  await commit({ db, profile: {}, deptId: 'icu', fieldValue: { delete: () => 'DEL' }, prev, next, now: 'T' });
  assert.equal(sent['items.i2'], 'DEL');
  sent = null;
  await commit({ db, profile: {}, deptId: 'icu', fieldValue: { delete: () => 'DEL' }, prev, next: clone(prev) });
  assert.equal(sent, null);
  assert.equal(toNewDocument(prev, 'icu').groups.g1.name, 'Injections');
});

test('other errors are not swallowed as "document missing"', async () => {
  const ref = { update: async () => { const e = new Error('denied'); e.code = 'permission-denied'; throw e; } };
  const db = { collection: () => ({ doc: () => ref }) };
  const prev = base(); const next = clone(prev); next.items.pop();
  await assert.rejects(commit({ db, profile: {}, deptId: 'icu', fieldValue: { delete: () => 'D' }, prev, next }), /denied/);
});

import { buildPublicSnapshot, publicUrl } from '../public/assets/js/core/supplier-inventory-store.js';

test('the public copy carries what the list shows and the QR link names the department and cabinet', () => {
  const doc = normalizeDoc({ groups: { g1: { name: 'Inj' } }, cabinets: { c1: { name: 'Cab 1' } },
    items: { i1: { name: 'A', code: 'a', groupId: 'g1', cabinetIds: ['c1'], notes: 'private', batches: [{ id: 'b1', expiry: '2027-01-01', batch: 'L', qty: 2 }] } } }, 'icu');
  const snap = buildPublicSnapshot(doc, { deptName: 'ICU', cfg: { d1: 30, d2: 7 }, now: 'T' });
  assert.deepEqual(snap.items[0], { name: 'A', code: 'a', group: 'Inj', cabinetIds: ['c1'], outOfStock: false, batches: [{ batch: 'L', expiry: '2027-01-01', qty: 2 }] });
  assert.equal(JSON.stringify(snap).includes('private'), false, 'notes and who-edited stay private');
  assert.equal(publicUrl('https://x.app', { deptId: 'icu', cabinetId: 'c1', tenantId: 't' }), 'https://x.app/?view=supplier-public&dept=icu&cab=c1&tenant=t');
  assert.equal(publicUrl('https://x.app', { deptId: 'icu' }), 'https://x.app/?view=supplier-public&dept=icu');
});
