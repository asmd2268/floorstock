import { hijriMonthKey, shiftHijriMonth } from './hijri-calendar.js?v=9e42fa0bb9';

/* State keys stored as one document per calendar month.

   Firestore charges per DOCUMENT read, not per byte, and a floorstock_state
   document is capped at 1 MiB. Those two facts pull in opposite directions for a
   ledger that must retain five years:

     one document per movement  →  no cap, but 91,000 documents to load five
                                   years once — 1.8x the entire free daily read
                                   allowance, per load, per client
     one document for all of it →  one read, but the 1 MiB cap arrives in weeks
     one document per month     →  60 documents for five years, each far below
                                   the cap: ~1,500x cheaper to read than the
                                   first, and no ceiling to hit like the second

   So: `<key>_hYYYY-MM`, and `<key>_hYYYY-MM_pN` if a month ever fills up, which
   is the same shape audit_log uses. Nothing is ever dropped to make room.

   The month is HIJRI (Umm al-Qura), not Gregorian. The pharmacy's own controlled
   and custody registers are kept in Hijri months, so a partition boundary here is
   the same boundary the officer reports against — a month's document IS the
   month's register, and exporting one is a single read. The `h` in the key name
   is there so a Hijri partition can never be mistaken for a Gregorian one (the
   audit trail, which is operational rather than regulatory, stays Gregorian).

   Rows are read back through monthPartitionRows(), which concatenates whatever
   partitions the state cache holds, so callers keep seeing one sorted array and
   did not have to change. Writes go to the partition the row's own date selects,
   inside a transaction, because two people recording a movement in the same
   month would otherwise overwrite each other — the previous whole-array shape
   had that race across the entire ledger. */

const registry = new Map();

// Leaves room under the 1 MiB cap for the write that crosses the threshold.
const PARTITION_MAX_BYTES = 800 * 1024;
const MAX_PARTS = 50;

/* key        the logical key callers still use, e.g. 'controlled_moves'
   dateField  fields tried in order to decide which month a row belongs to
   sortField  field the concatenated array is ordered by */
export function registerMonthPartitionedKey(spec) {
  registry.set(spec.key, Object.freeze(Object.assign({ maxBytes: PARTITION_MAX_BYTES }, spec)));
}

export function monthPartitionSpec(key) {
  return registry.get(key) || null;
}

export function monthPartitionedKeyNames() {
  return [...registry.keys()];
}

export function isMonthPartitionDoc(docId) {
  return monthPartitionedKeyNames().some(key => partitionPattern(key).test(String(docId || '')));
}

export function partitionPattern(key) {
  return new RegExp(`^${key}_h\\d{4}-\\d{2}(_p\\d+)?$`);
}

/* The Hijri month a row belongs to, from the first of its date fields that
   parses. A row whose date is missing or unreadable returns null and is refused
   rather than filed under an arbitrary month. */
export function monthOf(row, spec) {
  const fields = spec.dateField || ['at'];
  for (const field of fields) {
    const value = row && row[field];
    if (value == null || value === '') continue;
    const month = hijriMonthKey(value);
    if (month) return month;
  }
  return null;
}

export function partitionKey(key, month, part) {
  return (part || 1) <= 1 ? `${key}_h${month}` : `${key}_h${month}_p${part}`;
}

/* Every partition of `key` currently in the state cache, oldest month first.
   Partitions the session never loaded are simply absent — a scoped role holds
   the months it asked for, master holds all of them. */
export function partitionKeysInCache(key) {
  const cache = (globalThis.S && globalThis.S.cache) || {};
  const pattern = partitionPattern(key);
  return Object.keys(cache).filter(name => pattern.test(name)).sort();
}

export function monthPartitionRows(key) {
  const spec = monthPartitionSpec(key);
  if (!spec) return [];
  let rows = [];
  partitionKeysInCache(key).forEach((name) => {
    const value = globalThis.S.g(name);
    if (Array.isArray(value)) rows = rows.concat(value);
  });
  const sortField = spec.sortField || (spec.dateField && spec.dateField[0]) || 'at';
  return rows.sort((a, b) => String((a && a[sortField]) || '').localeCompare(String((b && b[sortField]) || ''))
    || String((a && a.id) || '').localeCompare(String((b && b.id) || '')));
}

/* The month keys a session should load: the current month and the previous
   `monthsBack`. Scoped roles cannot list the collection, so they name what they
   read; this is what fsStateKeysForProfile appends for them. */
export function recentPartitionKeys(key, monthsBack) {
  const keys = [];
  let month = hijriMonthKey(new Date());
  for (let index = 0; index <= (monthsBack || 0) && month; index += 1) {
    keys.push(`${key}_h${month}`);
    month = shiftHijriMonth(month, -1);
  }
  return keys;
}

function byteLength(value) {
  try { return new TextEncoder().encode(JSON.stringify(value)).length; }
  catch (error) { return Number.MAX_SAFE_INTEGER; }
}

function stateDocRef(docId) {
  if (!globalThis.FB_DB || typeof globalThis.stateCollectionRef !== 'function') return null;
  return globalThis.stateCollectionRef(globalThis.FB_DB, globalThis.S && globalThis.S.scopeProfile).doc(docId);
}

/* Appends rows to the partitions their own dates select, one transaction per
   partition so a concurrent writer in the same month cannot silently drop the
   other's row. Walks to the next part when a month would cross the size limit. */
export async function appendMonthPartitionedRows(key, rows) {
  const spec = monthPartitionSpec(key);
  if (!spec) throw new Error(`${key} is not a month-partitioned key.`);
  const incoming = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
  if (!incoming.length) return [];
  if (!globalThis.FB_DB) throw new Error('Firestore is unavailable; nothing was recorded.');

  const byMonth = {};
  incoming.forEach((row) => {
    const month = monthOf(row, spec);
    if (!month) throw new Error('A row needs a valid date before it can be recorded.');
    (byMonth[month] = byMonth[month] || []).push(row);
  });

  for (const month of Object.keys(byMonth)) {
    const monthRows = byMonth[month];
    let written = false;
    for (let part = 1; part <= MAX_PARTS && !written; part += 1) {
      const docId = partitionKey(key, month, part);
      const ref = stateDocRef(docId);
      if (!ref) throw new Error('Firestore is unavailable; nothing was recorded.');
      // eslint-disable-next-line no-await-in-loop
      const full = await globalThis.FB_DB.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const existing = snapshot.exists && Array.isArray(snapshot.data().value) ? snapshot.data().value : [];
        const next = existing.concat(monthRows);
        if (existing.length && byteLength(next) > spec.maxBytes) return true;
        tx.set(ref, { value: next, updatedAt: new Date().toISOString() }, { merge: false });
        return false;
      });
      if (!full) {
        applyLocally(key, docId, (current) => current.concat(monthRows));
        written = true;
      }
    }
    if (!written) throw new Error(`Every partition for ${month} is full.`);
  }
  scheduleRefresh();
  return incoming;
}

/* Replaces or removes one row, in whichever partition currently holds it. */
async function mutateExistingRow(key, rowId, transform) {
  const spec = monthPartitionSpec(key);
  if (!spec) throw new Error(`${key} is not a month-partitioned key.`);
  const id = String(rowId || '');
  if (!id) return false;
  const holder = partitionKeysInCache(key).find((name) => {
    const value = globalThis.S.g(name);
    return Array.isArray(value) && value.some((row) => row && String(row.id) === id);
  });
  if (!holder) return false;
  const ref = stateDocRef(holder);
  if (!ref) throw new Error('Firestore is unavailable; nothing was changed.');
  await globalThis.FB_DB.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const existing = snapshot.exists && Array.isArray(snapshot.data().value) ? snapshot.data().value : [];
    tx.set(ref, { value: transform(existing, id), updatedAt: new Date().toISOString() }, { merge: false });
  });
  applyLocally(key, holder, (current) => transform(current, id));
  scheduleRefresh();
  return true;
}

export function saveMonthPartitionedRow(key, row) {
  if (!row || !row.id) throw new Error('A row needs an id before it can be saved.');
  return mutateExistingRow(key, row.id, (rows, id) => rows.map((item) => (item && String(item.id) === id ? row : item)));
}

export function deleteMonthPartitionedRow(key, rowId) {
  return mutateExistingRow(key, rowId, (rows, id) => rows.filter((item) => !item || String(item.id) !== id));
}

/* The realtime listener is the source of truth, but only after the round trip.
   Applying locally first keeps a render immediately after an await from showing
   the pre-write ledger. */
function applyLocally(key, docId, transform) {
  if (!globalThis.S || !globalThis.S.cache) return;
  const current = Array.isArray(globalThis.S.cache[docId]) ? globalThis.S.cache[docId] : [];
  globalThis.S.cache[docId] = transform(current);
}

function scheduleRefresh() {
  if (globalThis.S && typeof globalThis.S.scheduleRefresh === 'function') globalThis.S.scheduleRefresh();
}

Object.assign(globalThis, {
  registerMonthPartitionedKey,
  monthPartitionSpec,
  monthPartitionedKeyNames,
  isMonthPartitionDoc,
  monthPartitionRows,
  partitionKeysInCache,
  recentPartitionKeys,
  monthOf,
  partitionKey,
  appendMonthPartitionedRows,
  saveMonthPartitionedRow,
  deleteMonthPartitionedRow,
});
