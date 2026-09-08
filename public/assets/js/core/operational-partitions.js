import {
  registerMonthPartitionedKey,
  appendMonthPartitionedRows,
  monthOf,
  monthPartitionSpec,
} from './month-partitioned-store.js?v=cc6daa3c27';
import { registerStorageCleanup } from './storage-cleanup.js?v=557a18ef07';

/* The remaining append-forever records, filed by month like the ledgers.

   requests and the two regulated registers were moved first because they were
   the ones already under pressure. These are the rest of the keys that grow with
   use and never shrink on their own, and every one of them ends the same way if
   left alone: a single 1 MiB document that one day refuses the write. The
   failure is not a slow page — a department cannot file a note, a deletion
   cannot be recorded, a receipt cannot be approved.

   Growth rates, measured from the app's own writers:

     user_activity_daily_v1   one row per user per day, forever, and every client
                              rewrote the WHOLE array every two minutes. Fifty
                              users is ~18,000 rows a year, each carrying an
                              iconCounts map. The worst of the five on both counts.
     deleted_request_audit_v4 one row per deleted order, each embedding a full
                              copy of the order — the heaviest row in the app.
     department_request_notifications_v1  one row per deletion notice, never pruned.
     dept_notes               one row per note; users resolve them but nothing
                              removes them.
     controlled_pdf_receipts  one row per approved warehouse receipt, with a line
                              per medicine.

   Calendars follow the same rule as everywhere else: the controlled register is
   Hijri because that is how the pharmacy reports it; operational records are
   Gregorian. The marker in the id (`_h` / `_g`) makes the two unmistakable.

   Nothing here changes a call site. Reads and writes already route through
   S.g/S.s, which send a registered key to its partitions; a whole-array save
   becomes a diff that touches only the months that actually changed — which is
   also what turns the activity flush from a full rewrite into one row. */

const SPECS = Object.freeze([
  {
    key: 'user_activity_daily_v1',
    calendar: 'gregorian',
    // The row id is uid_YYYY-MM-DD and `date` is that same day, so a row never
    // moves between months no matter how often the day's counters are updated.
    dateField: ['date'],
    sortField: 'date',
    sessionMonths: 3,
    label: 'File activity by month / ترحيل النشاط للأشهر',
    hint: 'Files staff activity into one record per month; each flush then writes a single row instead of the whole history.',
    noun: 'activity row',
    nounAr: 'سجل نشاط',
  },
  {
    key: 'deleted_request_audit_v4',
    calendar: 'gregorian',
    dateField: ['deletedAt'],
    sortField: 'deletedAt',
    sessionMonths: 12,
    label: 'File deletion audit by month / ترحيل سجل الحذف للأشهر',
    hint: 'Files the deleted-order audit into one record per month. Each entry carries a full copy of the order, so this is the heaviest record in the app.',
    noun: 'deletion record',
    nounAr: 'سجل حذف',
  },
  {
    key: 'department_request_notifications_v1',
    calendar: 'gregorian',
    dateField: ['createdAt'],
    sortField: 'createdAt',
    sessionMonths: 6,
    label: 'File notifications by month / ترحيل الإشعارات للأشهر',
    hint: 'Files department notifications into one record per month.',
    noun: 'notification',
    nounAr: 'إشعار',
  },
  {
    key: 'dept_notes',
    calendar: 'gregorian',
    dateField: ['created', 'updatedAt'],
    sortField: 'created',
    sessionMonths: 12,
    label: 'File notes by month / ترحيل الملاحظات للأشهر',
    hint: 'Files department notes into one record per month, so notes can never stop being submitted.',
    noun: 'note',
    nounAr: 'ملاحظة',
  },
  {
    key: 'accountability_receipts_v2',
    calendar: 'hijri',
    // Older receipts wrote the received date under two other names before the
    // field settled; all three are tried so a legacy row keeps its own month.
    dateField: ['receivedAt', 'createdAt', 'receivedDate'],
    sortField: 'receivedAt',
    sessionMonths: 12,
    label: 'File handovers by Hijri month / ترحيل الاستلامات للأشهر',
    hint: 'Files completed custody handovers into one record per Hijri month, the months the custody register is reported in.',
    noun: 'completed handover',
    nounAr: 'استلام مكتمل',
  },
  {
    key: 'controlled_pdf_receipts',
    calendar: 'hijri',
    dateField: ['created'],
    sortField: 'created',
    sessionMonths: 12,
    label: 'File PDF receipts by Hijri month / ترحيل استلامات PDF للأشهر',
    hint: 'Files approved warehouse receipts into one record per Hijri month, the same months the controlled register uses.',
    noun: 'receipt',
    nounAr: 'استلام',
  },
]);

SPECS.forEach((spec) => registerMonthPartitionedKey(spec));

export function operationalPartitionSpecs() {
  return SPECS;
}

function legacyRows(key) {
  const value = globalThis.S && typeof globalThis.S.g === 'function' ? globalThis.S.g(key) : null;
  return Array.isArray(value) ? value : null;
}

/* A row needs an id to be addressed inside its partition and a date to choose
   one. Rows written before this shape existed have neither — the deletion audit
   never carried an id at all — so both are supplied here rather than dropping
   the row. A row whose own date cannot be read is filed in the month it is
   migrated, which is honest about what is known: the alternative, `new Date(null)`,
   silently files it under 1970. */
function prepareRow(row, spec, index) {
  const prepared = Object.assign({}, row);
  if (!prepared.id) prepared.id = `${spec.key}_migrated_${index}_${Math.random().toString(36).slice(2, 9)}`;
  prepared.id = String(prepared.id);
  if (!monthOf(prepared, monthPartitionSpec(spec.key) || spec)) {
    prepared[spec.dateField[0]] = new Date().toISOString();
    prepared.migratedWithoutDate = true;
  }
  return prepared;
}

export async function migrateKeyToMonths(key) {
  const spec = SPECS.find((item) => item.key === key);
  if (!spec) throw new Error(`${key} is not an operational month-partitioned key.`);
  if (!(globalThis.CU && globalThis.CU.master === true)) {
    globalThis.toast('Only Master can file records by month.', 'err');
    return;
  }
  const rows = legacyRows(spec.key);
  if (!rows) {
    globalThis.toast(`No legacy ${spec.noun} record found — already stored by month.`, 'info');
    return;
  }
  if (!rows.length) {
    await globalThis.S.rm(spec.key);
    globalThis.toast(`The legacy ${spec.noun} record was already empty and has been removed.`, 'succ');
    return;
  }

  const prepared = rows.map((row, index) => prepareRow(row, spec, index));
  const months = [...new Set(prepared.map((row) => monthOf(row, monthPartitionSpec(spec.key)) || ''))].filter(Boolean).sort();
  const calendarWord = spec.calendar === 'gregorian' ? 'monthly' : 'Hijri monthly';
  const confirmed = await globalThis.uiConfirm(
    `${prepared.length} ${spec.noun}(s) will be filed into ${months.length} ${calendarWord} record(s), from ${months[0]} to ${months[months.length - 1]}.\n\n`
    + 'Nothing is deleted until every row has been filed, and re-running is safe.\n\n'
    + `سيتم توزيع ${prepared.length} ${spec.nounAr} على ${months.length} سجل شهري. لن يُحذف القديم إلا بعد اكتمال النسخ.`,
    { okText: 'File by month / ترحيل للأشهر' },
  );
  if (!confirmed) { globalThis.toast('Migration cancelled; nothing changed.', 'info'); return; }

  await appendMonthPartitionedRows(spec.key, prepared);
  await globalThis.S.rm(spec.key);
  globalThis.toast(`${prepared.length} ${spec.noun}(s) filed into ${months.length} monthly record(s). This record can no longer fill up. ✓`, 'succ');
}

/* One entry per key, registered against the key's own gauge row, so the action
   sits next to the bar it shrinks and disappears with the legacy document. */
SPECS.forEach((spec) => registerStorageCleanup({
  key: spec.key,
  label: spec.label,
  hint: spec.hint,
  run: () => migrateKeyToMonths(spec.key),
  canRun: () => !!(globalThis.CU && globalThis.CU.master === true) && !!legacyRows(spec.key),
}));

Object.assign(globalThis, { operationalPartitionSpecs, migrateKeyToMonths });
