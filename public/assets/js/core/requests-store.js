import {
  registerMonthPartitionedKey,
  monthPartitionRows,
  appendMonthPartitionedRows,
  saveMonthPartitionedRow,
  deleteMonthPartitionedRow,
  partitionKeysInCache,
} from './month-partitioned-store.js?v=9a4f8c0b46';
import { registerStorageCleanup } from './storage-cleanup.js?v=11c6be7dda';
import { legacyStateDoc, legacyStateDocExists } from './legacy-state-doc.js?v=95b728cbfc';

/* Orders, one document per Gregorian month.

   requests was the last key that could actually fill. A single document capped at
   1 MiB, growing with every order — and when it crossed, Firestore refused the
   write, so departments could not submit orders at all until a master archived.
   Departments cannot archive; that is master-only. A hospital-wide stop, waiting
   on one person.

   Gregorian months, not Hijri. The controlled and custody registers are kept in
   Hijri because that is how the pharmacy reports them to a regulator; orders are
   operational and follow the calendar the wards actually schedule by. The `_g`
   marker in the document id says which calendar a partition belongs to, so the
   two can never be confused.

   Nothing is deleted to make room. A month that fills rolls to a numbered part,
   so the ceiling is never reached and archiving stays what it was meant to be:
   optional housekeeping that trims the live view, not a rescue. */

export const REQUESTS_KEY = 'requests';

registerMonthPartitionedKey({
  key: REQUESTS_KEY,
  calendar: 'gregorian',
  // An order is filed by when it was placed; fulfilledAt is the fallback for
  // rows that predate `created` being written.
  dateField: ['created', 'fulfilledAt'],
  sortField: 'created',
  /* Orders are read far more often and by far more roles than the ledgers, and a
     department's working view is the last few weeks, so a short window keeps the
     read cost down. Older months stay reachable by a master, who lists the whole
     collection rather than naming documents. */
  sessionMonths: 3,
});

export function requestRows() {
  return monthPartitionRows(REQUESTS_KEY);
}

export function appendRequests(rows) {
  return appendMonthPartitionedRows(REQUESTS_KEY, rows);
}

/* One-time migration of the single requests document into Gregorian months.
   Rows are filed into their months first and the old document removed only
   afterwards, so nothing is deleted before it exists elsewhere; re-running is
   safe because rows are matched by id within a month. */
export async function migrateRequestsToMonths(options) {
  if (!(globalThis.CU && globalThis.CU.master === true)) {
    globalThis.toast('Only Master can migrate the orders record.', 'err');
    return;
  }
  const legacy = legacyStateDoc(REQUESTS_KEY);
  const rows = legacy || [];
  if (!rows.length) {
    if (legacy !== null) {
      await globalThis.S.rm(REQUESTS_KEY);
      globalThis.toast('The legacy orders record was already empty and has been removed.', 'succ');
    } else {
      globalThis.toast('No legacy orders record found — orders are already stored by month.', 'info');
    }
    return;
  }

  const dated = rows.map((row, index) => Object.assign({}, row, {
    /* Derived from the row's own content, never random: importing the same
       order twice must produce the same id and land on the row already there. */
    id: String((row && row.id) || stableRowId('req', row)),
    created: (row && (row.created || row.fulfilledAt)) || new Date().toISOString(),
  }));
  const months = [...new Set(dated.map((row) => String(row.created).slice(0, 7)))].sort();

  const confirmed = (options && options.silent) || await globalThis.uiConfirm(
    `${dated.length} order(s) will be filed into ${months.length} monthly record(s), from ${months[0]} to ${months[months.length - 1]}.\n\n`
    + 'This removes the size limit that could stop departments submitting orders. Nothing is deleted until every order has been filed, and re-running is safe.\n\n'
    + `سيتم توزيع ${dated.length} طلبًا على ${months.length} سجل شهري. لن يُحذف القديم إلا بعد اكتمال النسخ.`,
    { okText: 'Migrate orders / ترحيل الطلبات' },
  );
  if (!confirmed) { globalThis.toast('Migration cancelled; nothing changed.', 'info'); return; }

  await appendRequests(dated);
  await globalThis.S.rm(REQUESTS_KEY);
  globalThis.toast(`${dated.length} order(s) filed into ${months.length} monthly record(s). Orders can no longer fill up. ✓`, 'succ');
}

/* Shown only while the legacy document still exists; it disappears with it. */
registerStorageCleanup({
  kind: 'migration',
  key: REQUESTS_KEY,
  label: 'File orders by month / ترحيل الطلبات للأشهر',
  hint: 'Files orders into one record per month, removing the size limit that could stop departments submitting orders.',
  run: (options) => migrateRequestsToMonths(options),
  canRun: () => !!(globalThis.CU && globalThis.CU.master === true)
    && legacyStateDocExists(REQUESTS_KEY),
});

Object.assign(globalThis, {
  REQUESTS_KEY,
  requestRows,
  migrateRequestsToMonths,
});
