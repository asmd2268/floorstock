import { registerStorageCleanup } from './storage-cleanup.js?v=11c6be7dda';

/* Documents left behind by features that no longer exist.

   A removed feature takes its code with it but not its data: the document stays
   in floorstock_state, is loaded into every master session, and shows up on the
   storage gauge as something to worry about — with no action beside it, because
   the module that would have owned the action is gone. That is how
   inventory_authoritative_rollback_backups_v1 came to sit at 264 KB with nothing
   in the codebase referring to it at all.

   So retired keys are listed here, one line each, with what they were and why
   they are finished. Deleting one is a master's own action, with the same
   confirmation as any other cleanup — this file removes the mystery, not the
   decision. Anything still referenced by live code does NOT belong here; it
   belongs to the module that owns it. */

const RETIRED = Object.freeze([
  {
    key: 'inventory_authoritative_rollback_backups_v1',
    label: 'Delete obsolete rollback backup / حذف نسخة التراجع القديمة',
    /* Written by the one-off "authoritative rollback" that undid a faulty
       inventory-name merge in July 2026 (index.html at 6042bd8, since removed).
       Before restoring each department's pre-merge snapshot it saved that
       department's then-current medicine and expiry lists here, so the rollback
       itself could be reversed. The routine is gone, so nothing can read this
       back — and restoring a July inventory over everything since would destroy
       far more than it recovered. */
    hint: 'Left over from the July 2026 inventory-name rollback. The feature that wrote it no longer exists and nothing reads it.',
    what: 'the pre-rollback inventory snapshots from July 2026',
    whatAr: 'نسخ المخزون قبل التراجع في يوليو ٢٠٢٦',
  },
]);

export function retiredStateKeys() {
  return RETIRED.map((entry) => entry.key);
}

function isMaster() {
  return !!(globalThis.CU && globalThis.CU.master === true);
}

async function deleteRetired(entry) {
  if (!isMaster()) { globalThis.toast('Only Master can delete a retired record.', 'err'); return; }
  const value = globalThis.S.g(entry.key);
  if (value == null) { globalThis.toast('That record no longer exists.', 'info'); return; }
  const rows = Array.isArray(value) ? value.length : null;
  const confirmed = await globalThis.uiConfirm(
    `Delete ${entry.key}?\n\nIt holds ${entry.what}${rows == null ? '' : ` — ${rows} entr${rows === 1 ? 'y' : 'ies'}`}. `
    + 'The feature that wrote it was removed, so nothing in the app reads it.\n\n'
    + 'Your Local Backups contain a copy of every state record, including this one, so it can still be recovered from there.\n\n'
    + `سيتم حذف ${entry.key} — ${entry.whatAr}. الميزة التي كتبته لم تعد موجودة ولا يقرأه شيء. النسخة المحلية تحتفظ بنسخة منه.`,
    { okText: 'Delete / حذف' },
  );
  if (!confirmed) { globalThis.toast('Nothing was deleted.', 'info'); return; }
  await globalThis.S.rm(entry.key);
  globalThis.toast(`${entry.key} deleted. ✓`, 'succ');
}

RETIRED.forEach((entry) => registerStorageCleanup({
  key: entry.key,
  label: entry.label,
  hint: entry.hint,
  run: () => deleteRetired(entry),
  canRun: () => isMaster(),
}));

Object.assign(globalThis, { retiredStateKeys });
