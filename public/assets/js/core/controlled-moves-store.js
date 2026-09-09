import { hijriMonthLabelBilingual, hijriMonthKey } from './hijri-calendar.js?v=7cb3fbc1ff';
import { legacyStateDoc, legacyStateDocExists } from './legacy-state-doc.js?v=95b728cbfc';
import {
  registerMonthPartitionedKey,
  monthPartitionRows,
  appendMonthPartitionedRows,
  saveMonthPartitionedRow,
  deleteMonthPartitionedRow,
  partitionKeysInCache,
  partitionKey,
} from './month-partitioned-store.js?v=405d877017';
import { registerStorageCleanup } from './storage-cleanup.js?v=b360482df7';

/* The controlled / narcotic movement ledger, one document per HIJRI month.

   Three shapes were considered and the choice is a cost decision, not a taste one:

     one array in one document  →  1 read, but the 1 MiB cap arrives in weeks and
                                   five years of movements never fit
     one document per movement  →  no cap, but ~91,000 documents after five years;
                                   loading the ledger once costs 1.8x the entire
                                   free daily read allowance, per client
     one document per Hijri month → 60 documents for five years, each well under
                                   the cap. ~1,500x cheaper to read than the
                                   second, with no ceiling like the first.

   Hijri because the pharmacy's controlled register is kept in Hijri months, so a
   partition IS a month's register: exporting one month is a single document read
   and the boundaries match what the custody officer reports against.

   Reads go through ctlMoves() -> monthPartitionRows(), which concatenates the
   partitions the session holds into the one sorted array every caller already
   expected. Writes touch only the month a movement belongs to, inside a
   transaction, so two people recording in the same month cannot overwrite each
   other — the previous whole-array shape had that race across the entire ledger. */

export const CONTROLLED_MOVES_KEY = 'controlled_moves';

registerMonthPartitionedKey({
  key: CONTROLLED_MOVES_KEY,
  dateField: ['at'],
  sortField: 'at',
});

export function controlledMoveRows() {
  return monthPartitionRows(CONTROLLED_MOVES_KEY);
}

/* Appends movements to the Hijri months their own dates select. One write per
   month touched, regardless of how long the ledger already is. */
export function appendControlledMoves(moves) {
  return appendMonthPartitionedRows(CONTROLLED_MOVES_KEY, moves);
}

export function saveControlledMove(move) {
  return saveMonthPartitionedRow(CONTROLLED_MOVES_KEY, move);
}

export function deleteControlledMove(moveId) {
  return deleteMonthPartitionedRow(CONTROLLED_MOVES_KEY, moveId);
}

/* Which Hijri months this session actually holds, newest first — the export
   picker offers exactly these, so it can never offer a month it cannot read. */
export function availableControlledMonths() {
  const months = new Set();
  partitionKeysInCache(CONTROLLED_MOVES_KEY).forEach((name) => {
    const match = /_h(\d{4}-\d{2})(_p\d+)?$/.exec(name);
    if (match) months.add(match[1]);
  });
  return [...months].sort().reverse();
}

export function controlledMovesForMonths(monthKeys) {
  const wanted = new Set(monthKeys || []);
  return controlledMoveRows().filter((row) => wanted.has(hijriMonthKey(row && row.at)));
}

/* One-time migration to the Hijri-month partitions.

   Handles both earlier shapes: the original single floorstock_state document and
   the short-lived one-document-per-movement collection. Rows are written into
   their months first and the old home is removed only afterwards, so nothing is
   deleted before it exists elsewhere; re-running is safe because a month's rows
   are matched by id. */
export async function migrateControlledMovesToMonths(options) {
  if (!(globalThis.CU && globalThis.CU.master === true)) {
    globalThis.toast('Only Master can migrate the controlled movement ledger.', 'err');
    return;
  }
  const legacyBlob = legacyStateDoc(CONTROLLED_MOVES_KEY);
  const legacyRows = legacyBlob || [];
  if (!legacyRows.length) {
    if (legacyBlob !== null) {
      await globalThis.S.rm(CONTROLLED_MOVES_KEY);
      globalThis.toast('The legacy movement record was already empty and has been removed.', 'succ');
    } else {
      globalThis.toast('No legacy movement record found — the ledger is already stored by Hijri month.', 'info');
    }
    return;
  }

  const dated = legacyRows.map((row, index) => Object.assign({}, row, {
    id: String((row && row.id) || `ctl_migrated_${index}_${Math.random().toString(36).slice(2, 9)}`),
    at: (row && row.at) || new Date().toISOString(),
  }));
  const months = [...new Set(dated.map((row) => hijriMonthKey(row.at)).filter(Boolean))].sort();

  const confirmed = (options && options.silent) || await globalThis.uiConfirm(
    `${dated.length} controlled/narcotic movement(s) will be filed into ${months.length} Hijri month record(s), from `
    + `${hijriMonthLabelBilingual(months[0])} to ${hijriMonthLabelBilingual(months[months.length - 1])}.\n\n`
    + 'This removes the size limit that stopped the ledger holding five years, and makes reading a month cost one record instead of one per movement. '
    + 'Nothing is deleted until every movement has been filed, and re-running is safe.\n\n'
    + `سيتم توزيع ${dated.length} حركة على ${months.length} سجل شهري هجري. لن يُحذف القديم إلا بعد اكتمال النسخ.`,
    { okText: 'Migrate the ledger / ترحيل السجل' },
  );
  if (!confirmed) { globalThis.toast('Migration cancelled; nothing changed.', 'info'); return; }

  const undated = dated.filter((row) => !hijriMonthKey(row.at));
  if (undated.length) {
    globalThis.toast(`${undated.length} movement(s) have no readable date and cannot be filed. Fix them first.`, 'err');
    return;
  }

  await appendControlledMoves(dated);
  await globalThis.S.rm(CONTROLLED_MOVES_KEY);
  globalThis.toast(`${dated.length} movement(s) filed into ${months.length} Hijri month record(s). The ledger no longer has a size limit. ✓`, 'succ');
}

/* Visible only while a legacy blob document still exists; once migrated the
   document is gone and the entry disappears from the panel on its own. */
registerStorageCleanup({
  kind: 'migration',
  key: CONTROLLED_MOVES_KEY,
  label: 'File ledger by Hijri month / ترحيل السجل للأشهر الهجرية',
  hint: 'Files the movement ledger into one record per Hijri month, removing its size limit and making a month cost one read.',
  run: (options) => migrateControlledMovesToMonths(options),
  canRun: () => !!(globalThis.CU && globalThis.CU.master === true)
    && legacyStateDocExists(CONTROLLED_MOVES_KEY),
});

Object.assign(globalThis, {
  CONTROLLED_MOVES_KEY,
  controlledMoveRows,
  appendControlledMoves,
  saveControlledMove,
  deleteControlledMove,
  availableControlledMonths,
  controlledMovesForMonths,
  migrateControlledMovesToMonths,
  controlledMovePartitionKey: (month, part) => partitionKey(CONTROLLED_MOVES_KEY, month, part),
});
