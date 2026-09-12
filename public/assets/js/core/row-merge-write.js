import { stableRowFingerprint } from './row-fingerprint.js?v=9a446bb45d';

/* A shared array of rows, written without losing someone else's edit.

   `crash_carts` is one document holding every trolley, and every caller saves it
   the same way: read the whole array, change one cart, write the whole array
   back. Two pharmacists working on two different trolleys at the same moment
   therefore overwrite each other — the second save carries the first's cart in
   the state it had when that person's page loaded, so the first correction
   quietly disappears. Nothing errors. Nobody is told. The cart simply says
   something different tomorrow.

   Month-partitioned keys already avoid this: a save there is a diff, applied to
   the months that changed, inside a transaction. This is the same idea for a key
   that is not partitioned — the caller's INTENT is worked out by comparing what
   they are saving against what they had read, and only that intent is applied to
   whatever the document holds now.

   Rows the caller never touched are left exactly as the server has them, even if
   somebody changed them a second ago. */

function stateDocRef(key) {
  if (!globalThis.FB_DB || typeof globalThis.stateCollectionRef !== 'function') return null;
  return globalThis.stateCollectionRef(globalThis.FB_DB, globalThis.S && globalThis.S.scopeProfile).doc(key);
}

function stateStamp() {
  const firestore = globalThis.firebase && globalThis.firebase.firestore;
  return firestore && firestore.FieldValue ? firestore.FieldValue.serverTimestamp() : new Date();
}

function byId(rows) {
  const map = new Map();
  (rows || []).forEach((row) => { if (row && row.id != null) map.set(String(row.id), row); });
  return map;
}

/* What the caller changed, expressed as three sets rather than one array. */
export function rowIntent(previous, next) {
  const before = byId(previous);
  const after = byId(next);
  const added = [];
  const changed = [];
  const removed = [];
  after.forEach((row, id) => {
    if (!before.has(id)) { added.push(row); return; }
    if (stableRowFingerprint(row, ['__none__']) !== stableRowFingerprint(before.get(id), ['__none__'])) changed.push(row);
  });
  before.forEach((row, id) => { if (!after.has(id)) removed.push(id); });
  return { added, changed, removed };
}

export function applyIntent(serverRows, intent) {
  const removed = new Set(intent.removed);
  const changed = byId(intent.changed);
  const kept = (serverRows || []).filter((row) => !(row && row.id != null && removed.has(String(row.id))))
    .map((row) => (row && row.id != null && changed.has(String(row.id)) ? changed.get(String(row.id)) : row));
  const present = byId(kept);
  const appended = intent.added.filter((row) => !present.has(String(row.id)));
  return kept.concat(appended);
}

/* Saves `nextRows` for `key`, merging with whatever the document holds now.
   `baseline` is what the caller had read — the cached value by default, which is
   exactly what every caller in this app reads before editing. */
/* `fallback` performs the plain whole-value write and is required: this is
   called from S.s, so falling back through S.s would call straight back into
   here. */
export async function saveRowsMerging(key, nextRows, { baseline, fallback } = {}) {
  if (typeof fallback !== 'function') throw new Error('saveRowsMerging needs a fallback writer.');
  const previous = Array.isArray(baseline)
    ? baseline
    : (globalThis.S && Array.isArray(globalThis.S.cache[key]) ? globalThis.S.cache[key] : []);
  const intent = rowIntent(previous, nextRows || []);
  if (!intent.added.length && !intent.changed.length && !intent.removed.length) return nextRows;

  const ref = stateDocRef(key);
  /* No transaction available (REST transport, or Firestore not ready): fall back
     to the plain whole-array write rather than refusing to save. The race is
     narrower than losing the edit outright. */
  if (!ref || !globalThis.FB_DB.runTransaction) return fallback();

  const merged = await globalThis.FB_DB.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const serverRows = snapshot.exists && Array.isArray(snapshot.data().value) ? snapshot.data().value : previous;
    const result = applyIntent(serverRows, intent);
    transaction.set(ref, { value: result, updatedAt: stateStamp() }, { merge: false });
    return result;
  });
  if (globalThis.S && globalThis.S.cache) globalThis.S.cache[key] = merged;
  if (globalThis.S && typeof globalThis.S.scheduleRefresh === 'function') globalThis.S.scheduleRefresh();
  return merged;
}

Object.assign(globalThis, { saveRowsMerging });
