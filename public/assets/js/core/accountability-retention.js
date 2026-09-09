import { downloadJsonFile, downloadExcelFile, localArchiveDbSave } from './local-archive-utils.js?v=0f0cdae475';
import { registerStorageCleanup } from './storage-cleanup.js?v=efb839c9e4';
import { buildArchiveManifest, archiveFileName, describeArchive, localArchiveEntry } from './archive-manifest.js?v=6bf6b393b9';
import { uploadArchive } from './archive-storage.js?v=2e7d4b5e6f';
import { hijriMonthKey, hijriMonthLabelBilingual, hijriRetentionCutoffMonth, isPastHijriRetention } from './hijri-calendar.js?v=7cb3fbc1ff';
import { registerMonthPartitionedKey, monthPartitionRows, appendMonthPartitionedRows } from './month-partitioned-store.js?v=cc6daa3c27';

/* Accountability history retention.

   accountability_usage_v2 grows one row per custody consumption entry, in a
   single floorstock_state document capped at 1 MiB. A purge already existed and
   it DELETED outright: rows older than six months were exported to a file and
   then removed, with nothing left behind. Every figure computed from them —
   monthly consumption, units per medicine, units per department, rejection
   counts — dropped to zero for those months the moment it ran, so the reports
   disagreed with themselves depending on whether a master had tidied up.

   That is the same mistake order retention had already solved: the fix is not to
   keep the detail, it is to leave a compact, correctly-weighted summary behind.
   accountability_usage_summary_v1 holds one row per month × department ×
   medicine, carrying the summed units and the count of entries by status, and it
   is shaped like a usage row so the analytics panel needs no special case.

   What archiving costs is resolution, not totals: the per-patient detail (file
   number, doctor, reason, note) leaves Firestore in the downloaded file, which
   is the only full-detail copy afterwards. The per-entry handover timeline
   likewise only covers what is still live — the archive file is the record for
   older periods.

   The window matches the controlled/narcotic movement ledger: six HIJRI years.
   Custody covers controlled medicines, so the same floor applies, and it is
   counted in the calendar the register is kept in — measuring in Gregorian years
   while storing by Hijri month made "five years" mean two different spans. Six
   Hijri years is deliberately longer than any five-year reading of the rule. */

const ACCOUNTABILITY_RETENTION_YEARS = 6;
const USAGE_KEY = 'accountability_usage_v2';

/* Usage is stored one document per Hijri month, like the controlled movement
   ledger and for the same reason: a usage row is ~688 bytes, so a single document
   met the 1 MiB cap after roughly 1,500 entries — two to three months at twenty a
   day — which cannot carry a five-year retention floor at any setting. Reads still
   go through usageRows(), which concatenates the partitions the session holds. */
registerMonthPartitionedKey({
  key: USAGE_KEY,
  dateField: ['submittedAt', 'consumptionDate'],
  sortField: 'submittedAt',
});

export function usageRows() {
  return monthPartitionRows(USAGE_KEY);
}
const RECEIPTS_KEY = 'accountability_receipts_v2';
const SUMMARY_KEY = 'accountability_usage_summary_v1';

function retentionCutoffMonth() {
  return hijriRetentionCutoffMonth(ACCOUNTABILITY_RETENTION_YEARS);
}

export { ACCOUNTABILITY_RETENTION_YEARS };

/* `cutoff` is a Hijri month key. A row with no readable date is never past the
   floor — it is refused rather than deleted. */
export function olderThanRetention(value, cutoff) {
  return isPastHijriRetention(value, cutoff == null ? retentionCutoffMonth() : cutoff);
}

function monthKey(value) {
  // `new Date(undefined || 0)` is the epoch, not an invalid date, so a row with no
  // usable date would silently bucket into 1970-01 rather than being skipped.
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthStartIso(key) {
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toISOString();
}

/* One row per month × department × medicine. `status` is deliberately the
   synthetic 'archived' rather than any real workflow status: the analytics panel
   counts pending / awaiting-receipt / rejected rows by status, and an archived
   month must never be mistaken for live work waiting on someone. The real
   outcomes are preserved in statusCounts, which the panel adds separately. */
export function buildAccountabilityUsageAggregates(oldUsage) {
  const groups = {};
  (oldUsage || []).forEach((row) => {
    if (!row) return;
    const key = monthKey(row.consumptionDate || row.submittedAt);
    if (!key) return;
    const groupKey = `${key}|${String(row.deptId || '')}|${String(row.medName || '')}`;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        month: key,
        deptId: row.deptId || '',
        medName: row.medName || '',
        units: 0,
        entryCount: 0,
        statusCounts: {},
      };
    }
    const group = groups[groupKey];
    group.units += Number(row.units) || 0;
    group.entryCount += 1;
    const status = String(row.status || 'unknown');
    group.statusCounts[status] = (group.statusCounts[status] || 0) + 1;
  });
  return Object.keys(groups).map((groupKey) => {
    const group = groups[groupKey];
    const monthStart = monthStartIso(group.month);
    return {
      id: `accagg_${groupKey.replace(/[^a-z0-9_|-]/gi, '_')}`,
      deptId: group.deptId,
      medName: group.medName,
      units: group.units,
      entryCount: group.entryCount,
      statusCounts: group.statusCounts,
      // Both date fields are read by different panels; a month start satisfies
      // the YYYY-MM slicing every one of them does.
      consumptionDate: group.month + '-01',
      submittedAt: monthStart,
      status: 'archived',
      __aggregated: true,
    };
  });
}

/* Adds to an existing month row rather than replacing it: the purge runs more
   than once over the years and entries age past the cutoff between runs. */
export function mergeAccountabilityAggregates(existing, incoming) {
  const byId = {};
  (existing || []).forEach((row) => { if (row && row.id) byId[row.id] = row; });
  (incoming || []).forEach((row) => {
    if (!row || !row.id) return;
    const current = byId[row.id];
    if (!current) { byId[row.id] = row; return; }
    const statusCounts = Object.assign({}, current.statusCounts);
    Object.keys(row.statusCounts || {}).forEach((status) => {
      statusCounts[status] = (statusCounts[status] || 0) + row.statusCounts[status];
    });
    byId[row.id] = Object.assign({}, current, {
      units: (Number(current.units) || 0) + (Number(row.units) || 0),
      entryCount: (Number(current.entryCount) || 0) + (Number(row.entryCount) || 0),
      statusCounts,
    });
  });
  return Object.values(byId);
}

function isActualMaster() {
  return typeof globalThis.isActualMaster === 'function'
    ? globalThis.isActualMaster()
    : !!(globalThis.CU && globalThis.CU.master === true);
}

function stateRows(key) {
  if (key === USAGE_KEY) return usageRows();
  const value = globalThis.S && typeof globalThis.S.g === 'function' ? globalThis.S.g(key) : null;
  return Array.isArray(value) ? value : [];
}

export async function archiveAccountabilityHistory() {
  if (!isActualMaster()) {
    globalThis.toast('Actual Master access is required. / يتطلب صلاحية الماستر الفعلية.', 'err');
    return;
  }
  const cutoff = retentionCutoffMonth();
  const usage = stateRows(USAGE_KEY);
  const receipts = stateRows(RECEIPTS_KEY);
  const isOldUsage = (row) => olderThanRetention(row.submittedAt || row.consumptionDate, cutoff);
  const isOldReceipt = (row) => olderThanRetention(row.receivedAt || row.createdAt || row.receivedDate, cutoff);
  const removedUsage = usage.filter(isOldUsage);
  const removedReceipts = receipts.filter(isOldReceipt);
  if (!removedUsage.length && !removedReceipts.length) {
    globalThis.toast(`No custody history older than ${ACCOUNTABILITY_RETENTION_YEARS} Hijri years (before ${hijriMonthLabelBilingual(cutoff)}). / لا توجد سجلات أقدم من ذلك.`, 'info');
    return;
  }

  const manifest = buildArchiveManifest({
    kind: 'Custody-History',
    rows: removedUsage.concat(removedReceipts),
    dateFields: ['submittedAt', 'consumptionDate', 'receivedAt', 'createdAt'],
    note: `Custody usage and receipts past the ${ACCOUNTABILITY_RETENTION_YEARS}-Hijri-year retention floor.`,
  });
  const fileName = archiveFileName(manifest, 'json');
  const exportPayload = {
    format: 'ASDHealth-Accountability-History-Archive',
    version: 3,
    manifest,
    exportedAt: manifest.savedAt,
    usageCount: removedUsage.length,
    receiptCount: removedReceipts.length,
    usage: removedUsage,
    receipts: removedReceipts,
  };
  downloadJsonFile(exportPayload, fileName);
  try {
    await downloadExcelFile(
      removedUsage.concat(removedReceipts.map((row) => Object.assign({ __kind: 'receipt' }, row))),
      [
        { label: 'Kind', value: (r) => (r.__kind === 'receipt' ? 'Receipt/Handover' : 'Usage') },
        { label: 'Date', value: (r) => { const d = r.submittedAt || r.consumptionDate || r.receivedAt || r.createdAt || r.receivedDate; return d ? new Date(d).toLocaleString() : ''; } },
        { label: 'Department', value: (r) => r.deptName || r.deptId || '' },
        { label: 'Medicine', value: (r) => r.medName || '' },
        { label: 'Units', value: (r) => (r.units != null ? Number(r.units) : '') },
        { label: 'Patient file', value: (r) => r.patientFile || '' },
        { label: 'Doctor', value: (r) => r.doctor || '' },
        { label: 'Reason', value: (r) => r.reasonLabel || '' },
        { label: 'Status', value: (r) => r.status || '' },
        { label: 'By', value: (r) => r.by || r.submittedBy || r.receivedBy || '' },
      ],
      archiveFileName(manifest, 'xlsx'),
    );
  } catch (excelError) {
    console.warn('Accountability Excel export failed; the JSON file (already downloaded) remains the full-detail copy.', excelError);
  }
  await localArchiveDbSave('accountability', localArchiveEntry(manifest, exportPayload));
  const upload = await uploadArchive(manifest, exportPayload);

  const confirmed = await globalThis.uiConfirm(
    `Files with the full detail of ${removedUsage.length} usage record(s) and ${removedReceipts.length} receipt/handover record(s) older than ${ACCOUNTABILITY_RETENTION_YEARS} Hijri years — everything before ${hijriMonthLabelBilingual(cutoff)} — have been downloaded.\n\n${describeArchive(manifest, fileName)}\n\n${upload.ok ? 'A copy is also kept in this project, readable only by Master.\nونسخة محفوظة في المشروع نفسه، يقرأها الماستر فقط.\n\n' : `The project copy could NOT be saved (${upload.reason}), so the downloaded files are the only copies.\n\n`}`
    + 'Monthly totals per department and medicine stay in the system, so consumption reports keep the same figures at monthly resolution. The per-patient detail and the per-entry handover timeline for those months live only in these files afterwards.\n\n'
    + 'Active custody lines and regimens are never touched. Confirm you saved the files and want to continue?\n\n'
    + 'تم تنزيل ملفات بالتفاصيل الكاملة. تبقى المجاميع الشهرية في النظام فتظل التقارير بنفس الأرقام. أكّد أنك حفظت الملفات.',
    { danger: true, okText: 'I saved the files — archive now' },
  );
  if (!confirmed) {
    globalThis.toast('Archive files downloaded; nothing was removed. Re-run this action when ready.', 'info');
    return;
  }

  const previousSummary = stateRows(SUMMARY_KEY);
  const summary = mergeAccountabilityAggregates(previousSummary, buildAccountabilityUsageAggregates(removedUsage));
  await globalThis.S.s(SUMMARY_KEY, summary);

  /* Three documents, no transaction across them. The summary merge ADDS to an
     existing month, so a trim that failed after it was written would double-count
     those months on a retry. Restoring the previous summary keeps a retry
     correct; the trims themselves are filters and are safe to repeat. */
  try {
    // Usage lives across Hijri-month documents, so archived rows are removed from
    // whichever month holds each one; only the months actually touched are written.
    for (const row of removedUsage) {
      // eslint-disable-next-line no-await-in-loop
      await globalThis.deleteMonthPartitionedRow(USAGE_KEY, row.id);
    }
    try {
      /* Receipts are Hijri-month documents too now, so this save is a diff: S.s
         removes each archived row from the month that holds it and leaves every
         other month untouched. */
      await globalThis.S.s(RECEIPTS_KEY, receipts.filter((row) => !isOldReceipt(row)));
    } catch (receiptsError) {
      await globalThis.appendMonthPartitionedRows(USAGE_KEY, removedUsage);
      throw receiptsError;
    }
  } catch (trimError) {
    try { await globalThis.S.s(SUMMARY_KEY, previousSummary); }
    catch (rollbackError) { console.error('Could not restore the previous accountability summary; re-running would double-count these months.', rollbackError); }
    console.error(trimError);
    globalThis.toast(String((trimError && trimError.message) || trimError), 'err');
    return;
  }

  if (typeof globalThis.auditAction === 'function') {
    await Promise.resolve(globalThis.auditAction('accountability_history_retention_archive', {
      olderThanHijriYears: ACCOUNTABILITY_RETENTION_YEARS,
      removedUsage: removedUsage.length,
      removedReceipts: removedReceipts.length,
      summaryRows: summary.length,
    })).catch((error) => console.warn('Accountability retention audit warning', error));
  }
  globalThis.toast(`${removedUsage.length + removedReceipts.length} accountability record(s) archived; monthly totals preserved for reports. ✓`, 'succ');
  if (typeof globalThis.renderMedicationAccountability === 'function') globalThis.renderMedicationAccountability();
}

/* One-time migration: the single accountability_usage_v2 document into Hijri
   months. Rows are filed into their months first and the old document removed
   only afterwards, so nothing is deleted before it exists elsewhere; re-running
   is safe because rows are matched by id within a month. */
export async function migrateAccountabilityUsageToMonths() {
  if (!isActualMaster()) {
    globalThis.toast('Only Master can migrate the custody records.', 'err');
    return;
  }
  const legacy = globalThis.S && typeof globalThis.S.g === 'function' ? globalThis.S.g(USAGE_KEY) : null;
  const rows = Array.isArray(legacy) ? legacy : [];
  if (!rows.length) {
    if (legacy !== null) {
      await globalThis.S.rm(USAGE_KEY);
      globalThis.toast('The legacy custody record was already empty and has been removed.', 'succ');
    } else {
      globalThis.toast('No legacy custody record found — usage is already stored by Hijri month.', 'info');
    }
    return;
  }

  const undated = rows.filter((row) => !hijriMonthKey(row && (row.submittedAt || row.consumptionDate)));
  if (undated.length) {
    globalThis.toast(`${undated.length} usage record(s) have no readable date and cannot be filed. Fix them first.`, 'err');
    return;
  }
  const months = [...new Set(rows.map((row) => hijriMonthKey(row.submittedAt || row.consumptionDate)))].sort();

  const confirmed = await globalThis.uiConfirm(
    `${rows.length} custody usage record(s) will be filed into ${months.length} Hijri month record(s), from `
    + `${hijriMonthLabelBilingual(months[0])} to ${hijriMonthLabelBilingual(months[months.length - 1])}.\n\n`
    + 'This removes the size limit that stopped custody records holding five years. Nothing is deleted until every record has been filed, and re-running is safe.\n\n'
    + `سيتم توزيع ${rows.length} سجل عهدة على ${months.length} سجل شهري هجري. لن يُحذف القديم إلا بعد اكتمال النسخ.`,
    { okText: 'Migrate custody records / ترحيل السجلات' },
  );
  if (!confirmed) { globalThis.toast('Migration cancelled; nothing changed.', 'info'); return; }

  await appendMonthPartitionedRows(USAGE_KEY, rows);
  await globalThis.S.rm(USAGE_KEY);
  globalThis.toast(`${rows.length} custody record(s) filed into ${months.length} Hijri month record(s). ✓`, 'succ');
}

/* Two actions, two keys, because registerStorageCleanup allows one per key. The
   migration is offered under the legacy document's own key and disappears with it
   once it has run; the archive is offered under the ledger's synthetic row. */
registerStorageCleanup({
  key: USAGE_KEY,
  label: 'File custody by Hijri month / ترحيل سجل العهد',
  hint: 'Files custody usage into one record per Hijri month, removing the size limit that stopped it holding five years.',
  run: () => migrateAccountabilityUsageToMonths(),
  canRun: () => isActualMaster() && Array.isArray(globalThis.S && globalThis.S.g && globalThis.S.g(USAGE_KEY)),
});

registerStorageCleanup({
  key: `${USAGE_KEY}_ledger`,
  label: 'Archive history > 6 Hijri years / أرشفة سجل العهد',
  hint: 'Optional. Downloads full detail as JSON + Excel, keeps monthly totals per department and medicine, then removes entries past the 6-Hijri-year regulatory floor.',
  run: () => archiveAccountabilityHistory(),
  canRun: () => isActualMaster(),
});

Object.assign(globalThis, {
  ACCOUNTABILITY_RETENTION_YEARS,
  buildAccountabilityUsageAggregates,
  mergeAccountabilityAggregates,
  archiveAccountabilityHistory,
  migrateAccountabilityUsageToMonths,
  usageRows,
  olderThanRetention,
});
