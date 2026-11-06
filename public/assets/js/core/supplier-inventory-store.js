/* Supplier Inventory — where a department's list lives.

   One document per department, in its own collection so the rules can say
   "this department and the Master only" (the shared state collection can be
   listed by other pharmacy roles, so private data cannot live there):

     legacy   supplier_inventory/{deptId}
     tenant   tenants/{tenantId}/supplier_inventory/{deptId}

   The document holds four maps — items, groups, cabinets, settings. Writes are
   field-path updates (`items.<id>`), so two people editing different items at
   the same time never overwrite each other; only the same item can collide.

   Nothing here touches the DOM. The Firestore handle and FieldValue are passed
   in, which keeps the diffing logic testable without a browser. */

import { SCHEMA } from './supplier-inventory-model.js?v=6b35c5abc7';

export const COLLECTION = 'supplier_inventory';

export function tenantIdOf(profile) {
  return String((profile && profile.tenantId) || '').trim();
}

export function docRef(db, profile, deptId) {
  const tenant = tenantIdOf(profile);
  const root = tenant ? db.collection('tenants').doc(tenant).collection(COLLECTION) : db.collection(COLLECTION);
  return root.doc(String(deptId));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function storedItem(item) {
  const { id, ...rest } = item;
  return rest;
}

/* What changed between two normalised documents, as field paths. `set` holds
   new or changed rows, `remove` holds the paths of rows that are gone. */
export function buildUpdate(prev, next) {
  const set = {};
  const remove = [];
  const sections = [
    ['items', (x) => storedItem(x)],
    ['groups', ({ id, ...r }) => r],
    ['cabinets', ({ id, ...r }) => r],
  ];
  sections.forEach(([key, strip]) => {
    const before = new Map(((prev && prev[key]) || []).map((r) => [r.id, strip(r)]));
    const after = new Map(((next && next[key]) || []).map((r) => [r.id, strip(r)]));
    after.forEach((row, id) => { if (!before.has(id) || !same(before.get(id), row)) set[`${key}.${id}`] = row; });
    before.forEach((_row, id) => { if (!after.has(id)) remove.push(`${key}.${id}`); });
  });
  const beforeSettings = (prev && prev.settings) || {};
  if (next && next.settings && !same(beforeSettings, next.settings)) set.settings = next.settings;
  return { set, remove, empty: !Object.keys(set).length && !remove.length };
}

/* The whole thing as a brand-new document, for the first write by a department. */
export function toNewDocument(next, deptId) {
  const out = { deptId: String(deptId), schema: SCHEMA, settings: next.settings, items: {}, groups: {}, cabinets: {} };
  next.items.forEach((r) => { out.items[r.id] = storedItem(r); });
  next.groups.forEach(({ id, ...r }) => { out.groups[id] = r; });
  next.cabinets.forEach(({ id, ...r }) => { out.cabinets[id] = r; });
  return out;
}

const isNotFound = (error) => !!error && (error.code === 'not-found' || /no document to update/i.test(String(error.message || '')));

/* Writes `change` (from buildUpdate) and returns when the server has it, or
   rejects. If the document does not exist yet it is created from `next`. */
export async function commit({ db, profile, deptId, fieldValue, prev, next, now }) {
  const diff = buildUpdate(prev, next);
  if (diff.empty) return diff;
  const ref = docRef(db, profile, deptId);
  const stamp = { deptId: String(deptId), schema: SCHEMA, updatedAt: now || new Date().toISOString() };
  const fields = Object.assign({}, diff.set, stamp);
  diff.remove.forEach((path) => { fields[path] = fieldValue.delete(); });
  try {
    await ref.update(fields);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await ref.set(Object.assign(toNewDocument(next, deptId), { updatedAt: stamp.updatedAt }), { merge: true });
  }
  return diff;
}

/* Live subscription. `onDoc(rawData|null, meta)` fires for every snapshot;
   `onState('live'|'cached'|'error', error)` drives the connection indicator,
   so a person is never shown cached data as if it were current. */
export function subscribe({ db, profile, deptId, onDoc, onState }) {
  const ref = docRef(db, profile, deptId);
  return ref.onSnapshot({ includeMetadataChanges: true }, (snap) => {
    const meta = { fromCache: !!snap.metadata.fromCache, pending: !!snap.metadata.hasPendingWrites };
    onState(meta.fromCache ? 'cached' : 'live');
    onDoc(snap.exists ? snap.data() : null, meta);
  }, (error) => onState('error', error));
}

/* ---- Public live mirror -------------------------------------------------
   Like public_expiry for medicines: a read-only copy a department publishes so
   its QR can open a live list with no sign-in. Anyone holding the QR (or the
   link) can read it, so it carries only what the printed list shows. */
export const PUBLIC_COLLECTION = 'public_supplier_inv';

export function buildPublicSnapshot(doc, { deptName, cfg, now }) {
  const groupName = new Map(doc.groups.map((g) => [g.id, g.name]));
  return {
    deptId: doc.deptId, departmentName: String(deptName || ''), updatedAt: now || new Date().toISOString(), alerts: { d1: cfg.d1, d2: cfg.d2 },
    cabinets: doc.cabinets.map((c) => ({ id: c.id, name: c.name })),
    items: doc.items.map((i) => ({
      name: i.name, code: i.code, group: groupName.get(i.groupId) || '', cabinetIds: i.cabinetIds.slice(), outOfStock: !!i.outOfStock,
      batches: i.batches.map((b) => ({ batch: b.batch || '', expiry: b.expiry || '', qty: b.qty == null ? null : b.qty })),
    })),
  };
}

export function publicRef(db, profile, deptId) {
  const tenant = tenantIdOf(profile);
  const root = tenant ? db.collection('tenants').doc(tenant).collection(PUBLIC_COLLECTION) : db.collection(PUBLIC_COLLECTION);
  return root.doc(String(deptId));
}

export function publicUrl(origin, { deptId, cabinetId, tenantId }) {
  const q = new URLSearchParams({ view: 'supplier-public', dept: String(deptId) });
  if (cabinetId) q.set('cab', cabinetId);
  if (tenantId) q.set('tenant', tenantId);
  return `${origin}/?${q.toString()}`;
}
