import { registerStorageCleanup } from './storage-cleanup.js?v=71c9bbd831';
import { registerAutoMaintenance } from './state-maintenance.js?v=8ef0a9d17f';
import { MERGE_HISTORY_POLICIES } from './upkeep-policy.js?v=fc7bd6e72a';

/* The undo history behind an inventory-name merge, kept under a byte budget
   rather than a row count.

   inventory_name_merge_history was capped at 20 entries and manual merge history
   at 100 — counts that say nothing about size, because an entry is not a line of
   text. Undoing a merge has to put every affected department's medicine list and
   expiry list back exactly as they were, so each entry carries a full copy of
   them. Twenty of those crossed the 1 MiB document cap in production: the gauge
   read 120%, and the next merge would simply have been refused.

   Months would not help here — this is not a record of events over time, it is a
   short undo stack, and a single entry can be large on its own. So it is capped
   the way a stack should be: keep the newest entries that fit the budget, and
   drop the oldest beyond it. Undo only ever uses the newest entry.

   An entry too large to fit the budget by itself keeps its identity — who merged
   what, when — but loses the department snapshots that made it huge, and says so
   with undoUnavailable. A merge that cannot be undone is worth recording; a
   merge that cannot be SAVED stops the whole feature. */

/* Roughly a third of the document cap: room for several ordinary entries with
   margin for the write that crosses the threshold. The number lives in
   upkeep-policy.json, which the scheduled Cloud Function reads too — it trims
   these same records on a timer, and a budget written in two places is a budget
   that eventually disagrees with itself. */
export const MERGE_HISTORY_BUDGET_BYTES = MERGE_HISTORY_POLICIES[0].maxBytes;

const KEYS = Object.freeze({
  inventory: 'inventory_name_merge_history',
  manual: 'manual_medicine_merge_history_v1',
});

function byteLength(value) {
  try { return new TextEncoder().encode(JSON.stringify(value)).length; }
  catch (error) { return Number.MAX_SAFE_INTEGER; }
}

/* Strips what makes an entry huge while keeping what makes it a record. */
function withoutSnapshots(row) {
  const stripped = Object.assign({}, row, { undoUnavailable: true });
  delete stripped.departments;
  delete stripped.expiry;
  delete stripped.records;
  return stripped;
}

/* Newest first in, oldest dropped — the order the callers already keep. */
export function trimMergeHistory(rows, budget) {
  const limit = budget || MERGE_HISTORY_BUDGET_BYTES;
  const kept = [];
  let used = 0;
  (rows || []).forEach((row) => {
    if (!row) return;
    let entry = row;
    let size = byteLength(entry);
    if (!kept.length && size > limit) { entry = withoutSnapshots(entry); size = byteLength(entry); }
    if (kept.length && used + size > limit) return;
    kept.push(entry);
    used += size;
  });
  return kept;
}

async function saveTrimmed(key, rows) {
  const trimmed = trimMergeHistory(rows);
  await globalThis.S.s(key, trimmed);
  return { kept: trimmed.length, dropped: (rows || []).length - trimmed.length };
}

export function saveInventoryMergeHistory(rows) {
  return saveTrimmed(KEYS.inventory, rows);
}

export function saveManualMergeHistory(rows) {
  return saveTrimmed(KEYS.manual, rows);
}

function historyRows(key) {
  const value = globalThis.S && typeof globalThis.S.g === 'function' ? globalThis.S.g(key) : null;
  return Array.isArray(value) ? value : [];
}

/* The master's way out when the document is already over the cap: trim now
   rather than waiting for the next merge to do it. */
async function trimNow(key, label) {
  if (!(globalThis.CU && globalThis.CU.master === true)) {
    globalThis.toast('Only Master can trim the merge history.', 'err');
    return;
  }
  const rows = historyRows(key);
  const trimmed = trimMergeHistory(rows);
  if (trimmed.length === rows.length && byteLength(rows) === byteLength(trimmed)) {
    globalThis.toast(`${label} is already within its size budget. / السجل ضمن الحد المسموح.`, 'info');
    return;
  }
  const confirmed = await globalThis.uiConfirm(
    `The ${rows.length} saved undo point(s) will be trimmed to the newest ${trimmed.length}, which is what fits under the document limit.\n\n`
    + 'Undo always uses the newest one, so undoing the last merge keeps working. Nothing in the inventory itself is changed.\n\n'
    + `سيتم الإبقاء على أحدث ${trimmed.length} نقطة تراجع فقط. التراجع يستخدم الأحدث دائمًا، ولن يتغير المخزون نفسه.`,
    { okText: 'Trim history / تقليص السجل' },
  );
  if (!confirmed) { globalThis.toast('Nothing was changed.', 'info'); return; }
  await globalThis.S.s(key, trimmed);
  globalThis.toast(`${rows.length - trimmed.length} old undo point(s) removed; ${trimmed.length} kept. ✓`, 'succ');
}

/* Trimmed automatically, without asking. An undo stack is not a record: nothing
   reads it but the Undo button, which only ever uses the newest entry, and it
   carries no statistics and no retention obligation. Waiting for a master to
   press a button meant the document sat at the cap until someone noticed the
   gauge — and the button only existed because nobody had noticed in time. The
   button stays for the master who wants to act now, and does the same thing. */
Object.values(KEYS).forEach((key) => registerAutoMaintenance({
  key,
  describe: (result) => `${result.dropped} old undo point(s) removed from ${key}`,
  run: async () => {
    const rows = historyRows(key);
    if (!rows.length) return null;
    const trimmed = trimMergeHistory(rows);
    if (trimmed.length === rows.length && byteLength(rows) === byteLength(trimmed)) return null;
    await globalThis.S.s(key, trimmed);
    return { kept: trimmed.length, dropped: rows.length - trimmed.length };
  },
}));

registerStorageCleanup({
  key: KEYS.inventory,
  label: 'Trim merge undo history / تقليص سجل التراجع',
  hint: 'Each undo point stores a full copy of every affected department’s medicine and expiry lists, so a few of them fill the document. Keeps the newest that fit; undo uses the newest.',
  run: () => trimNow(KEYS.inventory, 'The inventory merge history'),
  canRun: () => !!(globalThis.CU && globalThis.CU.master === true),
});

registerStorageCleanup({
  key: KEYS.manual,
  label: 'Trim merge undo history / تقليص سجل التراجع',
  hint: 'Keeps the newest manual-merge undo points that fit under the document limit.',
  run: () => trimNow(KEYS.manual, 'The manual merge history'),
  canRun: () => !!(globalThis.CU && globalThis.CU.master === true),
});

Object.assign(globalThis, {
  MERGE_HISTORY_BUDGET_BYTES,
  trimMergeHistory,
  saveInventoryMergeHistory,
  saveManualMergeHistory,
});
