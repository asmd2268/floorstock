import { hijriMonthKey, shiftHijriMonth } from './hijri-calendar.js?v=7cb3fbc1ff';
import { stableRowFingerprint, isSynthesizedMigrationId } from './row-fingerprint.js?v=9a446bb45d';

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
   calendar   'hijri' or 'gregorian' — which calendar's months partition it
   dateField  fields tried in order to decide which month a row belongs to
   sortField  field the concatenated array is ordered by

   Two calendars, on purpose. The controlled and custody registers are kept in
   Hijri months because that is how the pharmacy reports them, so a partition is
   the month's register. Orders are operational rather than regulatory and follow
   the Gregorian calendar everyone schedules by. The marker in the document id
   (`_h` or `_g`) says which, so a partition can never be read as the wrong
   calendar's month — the two disagree by about eleven days a year. */
export function registerMonthPartitionedKey(spec) {
  registry.set(spec.key, Object.freeze(Object.assign({ maxBytes: PARTITION_MAX_BYTES, calendar: 'hijri' }, spec)));
}

function marker(spec) {
  return (spec && spec.calendar) === 'gregorian' ? 'g' : 'h';
}

function gregorianMonthKey(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shiftGregorianMonth(monthKey, delta) {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return null;
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthKeyFor(spec, value) {
  return (spec && spec.calendar) === 'gregorian' ? gregorianMonthKey(value) : hijriMonthKey(value);
}

function shiftMonthFor(spec, monthKey, delta) {
  return (spec && spec.calendar) === 'gregorian'
    ? shiftGregorianMonth(monthKey, delta)
    : shiftHijriMonth(monthKey, delta);
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
  return new RegExp(`^${key}_${marker(monthPartitionSpec(key))}\\d{4}-\\d{2}(_p\\d+)?$`);
}

/* The month a row belongs to, in that key's own calendar, from the first of its
   date fields that parses. A row whose date is missing or unreadable returns null
   and is refused rather than filed under an arbitrary month. */
export function monthOf(row, spec) {
  const fields = spec.dateField || ['at'];
  for (const field of fields) {
    const value = row && row[field];
    if (value == null || value === '') continue;
    const month = monthKeyFor(spec, value);
    if (month) return month;
  }
  return null;
}

export function partitionKey(key, month, part) {
  const mark = marker(monthPartitionSpec(key));
  return (part || 1) <= 1 ? `${key}_${mark}${month}` : `${key}_${mark}${month}_p${part}`;
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
  const spec = monthPartitionSpec(key);
  const keys = [];
  let month = monthKeyFor(spec, new Date());
  for (let index = 0; index <= (monthsBack || 0) && month; index += 1) {
    keys.push(partitionKey(key, month, 1));
    month = shiftMonthFor(spec, month, -1);
  }
  return keys;
}

function byteLength(value) {
  try { return new TextEncoder().encode(JSON.stringify(value)).length; }
  catch (error) { return Number.MAX_SAFE_INTEGER; }
}

/* firestore.rules requires `updatedAt is timestamp` on every state document, so
   an ISO string here is refused outright — which is exactly how the Hijri
   migrations failed with "nothing was deleted". Every other writer in the app
   uses the server timestamp; this one now does too. */
function stateStamp() {
  const firestore = globalThis.firebase && globalThis.firebase.firestore;
  return firestore && firestore.FieldValue
    ? firestore.FieldValue.serverTimestamp()
    : new Date();
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
        tx.set(ref, { value: next, updatedAt: stateStamp() }, { merge: false });
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
    const next = transform(existing, id);
    /* A month emptied by archiving leaves no document behind. Keeping an empty
       one would cost a read on every load forever and make the partition list
       claim months that hold nothing. */
    if (!next.length) tx.delete(ref);
    else tx.set(ref, { value: next, updatedAt: stateStamp() }, { merge: false });
  });
  applyLocally(key, holder, (current) => transform(current, id));
  // Mirror the removal locally too, so the emptied month disappears at once.
  if (globalThis.S.cache[holder] && !globalThis.S.cache[holder].length) delete globalThis.S.cache[holder];
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

/* Applies a whole desired array to a partitioned key: writes what is new or
   changed, removes what is gone, and touches only the months involved.

   This is what lets the ten existing `S.s('requests', wholeArray)` call sites
   keep working unchanged. They hand over the array they always did; the diff
   turns that into a write per changed month instead of a rewrite of every order
   ever placed. */
export async function applyPartitionedArray(key, nextRows) {
  const spec = monthPartitionSpec(key);
  if (!spec) throw new Error(`${key} is not a month-partitioned key.`);
  const next = (nextRows || []).filter((row) => row && row.id);
  const current = monthPartitionRows(key);
  const nextById = new Map(next.map((row) => [String(row.id), row]));
  const currentById = new Map(current.map((row) => [String(row.id), row]));

  const added = next.filter((row) => !currentById.has(String(row.id)));
  const changed = next.filter((row) => {
    const before = currentById.get(String(row.id));
    return before && JSON.stringify(before) !== JSON.stringify(row);
  });
  const removed = current.filter((row) => !nextById.has(String(row.id)));

  if (added.length) await appendMonthPartitionedRows(key, added);
  for (const row of changed) await saveMonthPartitionedRow(key, row);
  for (const row of removed) await deleteMonthPartitionedRow(key, row.id);
  return { added: added.length, changed: changed.length, removed: removed.length };
}

/* Removes rows whose id already appeared in an earlier partition of the same key.

   A migration that ran twice appended the same rows a second time — the fix for
   that is in legacy-state-doc.js, and this is the repair for what it already
   wrote. Identical ids ARE duplicates: an id addresses one row, and every writer
   here replaces a row in place rather than adding a second with the same id. The
   first occurrence is kept, so the oldest partition keeps the row and the later
   copy goes.

   Reports untouched rather than pretending to work: a key with no duplicates
   writes nothing at all. */
export async function dedupeMonthPartitions(key) {
  if (!monthPartitionSpec(key)) return null;
  const seen = new Set();
  const fingerprints = new Set();
  let removed = 0;
  let before = 0;
  for (const docId of partitionKeysInCache(key)) {
    const rows = globalThis.S.cache[docId];
    if (!Array.isArray(rows) || !rows.length) continue;
    before += rows.length;
    const kept = rows.filter((row) => {
      const id = row && row.id != null ? String(row.id) : null;
      if (!id) return true;
      if (seen.has(id)) { removed += 1; return false; }
      /* A row that arrived without an id was given one — and it used to be
         random, so the same row imported twice became two rows with different
         ids that no id comparison can pair. Only those are matched by content;
         a row that came with its own id keeps its identity whatever it holds. */
      if (isSynthesizedMigrationId(id)) {
        const print = stableRowFingerprint(row);
        if (print) {
          if (fingerprints.has(print)) { removed += 1; return false; }
          fingerprints.add(print);
        }
      }
      seen.add(id);
      return true;
    });
    if (kept.length === rows.length) continue;
    const ref = stateDocRef(docId);
    if (!ref) throw new Error('Firestore is unavailable; nothing was changed.');
    // eslint-disable-next-line no-await-in-loop
    await ref.set({ value: kept, updatedAt: stateStamp() }, { merge: false });
    globalThis.S.cache[docId] = kept;
  }
  if (removed) scheduleRefresh();
  return removed ? { key, removed, before, after: before - removed } : null;
}

/* True once a key has been migrated: the single legacy document is gone and the
   partitions are the only home. Until then every read and write stays on the old
   path, so there is never a half-migrated state where some orders live in one
   place and some in another. */
export function partitionsAreLive(key) {
  if (!monthPartitionSpec(key)) return false;
  const legacy = globalThis.S && globalThis.S.cache ? globalThis.S.cache[key] : undefined;
  return !Array.isArray(legacy);
}

/* Mirrors a full set of rows back into the local cache, each into the partition
   its own date selects. Used after a Cloud Function commits a change: the callable
   writes server-side, so the cache would otherwise not move until the listener
   echoes back and the page would show stale rows for that moment.

   Local only — it never writes Firestore. Partitions the session holds that the
   new set no longer mentions are emptied, so a removed row disappears at once
   rather than lingering until the snapshot arrives. A month split across parts is
   collapsed into part 1 and its later parts emptied: this cannot know how the
   server chose to split them, and leaving them would show a row twice. The next
   listener snapshot restores the server's own split. */
export function mirrorMonthPartitionedRows(key, rows) {
  const spec = monthPartitionSpec(key);
  if (!spec || !globalThis.S || !globalThis.S.cache) return;
  const grouped = {};
  (rows || []).forEach((row) => {
    const month = monthOf(row, spec);
    if (!month) return;
    (grouped[month] = grouped[month] || []).push(row);
  });
  const placed = new Set();
  partitionKeysInCache(key).forEach((name) => {
    const match = new RegExp(`_${marker(spec)}(\\d{4}-\\d{2})(_p\\d+)?$`).exec(name);
    const month = match && match[1];
    if (!month) return;
    if (match[2]) { globalThis.S.cache[name] = []; return; }
    globalThis.S.cache[name] = grouped[month] || [];
    placed.add(month);
  });
  Object.keys(grouped).forEach((month) => {
    if (!placed.has(month)) globalThis.S.cache[partitionKey(key, month, 1)] = grouped[month];
  });
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
  mirrorMonthPartitionedRows,
  applyPartitionedArray,
  partitionsAreLive,
  dedupeMonthPartitions,
});
