import { hijriDateLabel, hijriMonthKey, hijriMonthLabelBilingual, hijriMonthsBetween } from './hijri-calendar.js?v=9e42fa0bb9';
import { partitionKey } from './month-partitioned-store.js?v=a9eafb6973';
import { CONTROLLED_MOVES_KEY, controlledMoveRows } from './controlled-moves-store.js?v=eec99dede1';
import { mayExportMonths, exportPermissionReason } from './export-grants.js?v=2e4e001f71';

/* Exporting the controlled ledger to Excel, one Hijri month or a range of them.

   Because the ledger is stored one document per Hijri month, an export is a
   direct read of exactly the months asked for — three months is three document
   reads, not a scan of five years. Months the session has not already loaded are
   fetched on demand here rather than being carried in every session, which is
   what keeps a five-year ledger inside the free read allowance.

   Who may run it is decided by core/export-grants.js: a master always, anyone
   else only under a live, time-limited grant that covers every month selected. */

const EXPORT_COLUMNS = [
  { label: 'Hijri date / التاريخ الهجري', value: (row) => hijriDateLabel(row.at) },
  { label: 'Gregorian date', value: (row) => String(row.at || '').slice(0, 10) },
  { label: 'Time', value: (row) => String(row.at || '').slice(11, 16) },
  { label: 'Type / النوع', value: (row) => row.type || '' },
  { label: 'Medicine / الدواء', value: (row) => row.medName || row.name || '' },
  { label: 'Classification', value: (row) => row.classification || '' },
  { label: 'Department / القسم', value: (row) => row.deptName || row.deptId || '' },
  { label: 'Quantity / الكمية', value: (row) => (row.qty == null ? '' : Number(row.qty)) },
  { label: 'Balance after / الرصيد', value: (row) => (row.balanceAfter == null ? '' : Number(row.balanceAfter)) },
  { label: 'Batch', value: (row) => row.batch || '' },
  { label: 'Expiry', value: (row) => row.expiry || '' },
  { label: 'Status', value: (row) => row.status || '' },
  { label: 'By / بواسطة', value: (row) => row.by || '' },
  { label: 'Note / ملاحظة', value: (row) => row.note || '' },
];

/* Reads the months that are not already in the session cache. Each month is one
   document, so this costs exactly one read per month not already held. */
async function loadMissingMonths(months) {
  if (!globalThis.FB_DB || typeof globalThis.stateCollectionRef !== 'function') return;
  const collection = globalThis.stateCollectionRef(globalThis.FB_DB, globalThis.S && globalThis.S.scopeProfile);
  for (const month of months) {
    // Part 1 holds the month unless it overflowed; parts are contiguous, so the
    // walk stops at the first one that does not exist.
    for (let part = 1; part <= 50; part += 1) {
      const docId = partitionKey(CONTROLLED_MOVES_KEY, month, part);
      if (globalThis.S.cache && Object.prototype.hasOwnProperty.call(globalThis.S.cache, docId)) continue;
      // eslint-disable-next-line no-await-in-loop
      const snapshot = await collection.doc(docId).get();
      if (!snapshot.exists) break;
      const data = snapshot.data() || {};
      globalThis.S.cache[docId] = Array.isArray(data.value) ? data.value : [];
    }
  }
}

export function controlledLedgerRowsForMonths(months) {
  const wanted = new Set(months || []);
  return controlledMoveRows()
    .filter((row) => wanted.has(hijriMonthKey(row && row.at)))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
}

/* fromMonth/toMonth are Hijri month keys such as '1448-01'. Passing the same
   value for both exports a single month. */
export async function exportControlledLedger(fromMonth, toMonth) {
  const from = String(fromMonth || '').trim();
  const to = String(toMonth || from).trim();
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to) || to < from) {
    globalThis.toast('Choose a valid Hijri month range. / اختر نطاق أشهر هجرية صحيح.', 'err');
    return null;
  }
  const months = hijriMonthsBetween(from, to);
  if (!months.length) {
    globalThis.toast('That range covers no months.', 'err');
    return null;
  }

  const refusal = exportPermissionReason(months);
  if (refusal || !mayExportMonths(months)) {
    globalThis.toast(refusal || 'You do not have permission to export these months.', 'err');
    return null;
  }

  try {
    await loadMissingMonths(months);
  } catch (error) {
    console.error('Could not read every selected month.', error);
    globalThis.toast('Some months could not be read. Nothing was exported. / تعذّرت قراءة بعض الأشهر.', 'err');
    return null;
  }

  const rows = controlledLedgerRowsForMonths(months);
  if (!rows.length) {
    globalThis.toast('No movements in the selected months. / لا توجد حركات في الأشهر المحددة.', 'info');
    return null;
  }

  const label = months.length === 1 ? from : `${from}_to_${to}`;
  const fileName = `Controlled_Ledger_Hijri_${label}.xlsx`;
  await globalThis.downloadExcelFile(rows, EXPORT_COLUMNS, fileName);

  if (typeof globalThis.auditAction === 'function') {
    // The export leaves per-movement detail in a file, so who took what and when
    // is itself worth recording.
    await Promise.resolve(globalThis.auditAction('controlled_ledger_exported', {
      fromMonth: from, toMonth: to, months: months.length, movements: rows.length,
    })).catch(() => {});
  }
  globalThis.toast(
    `${rows.length} movement(s) across ${months.length} Hijri month(s) exported. / تم تصدير ${rows.length} حركة عبر ${months.length} شهر.`,
    'succ',
  );
  return { months, rows: rows.length, fileName };
}

export function describeExportRange(fromMonth, toMonth) {
  if (!fromMonth) return '';
  if (!toMonth || toMonth === fromMonth) return hijriMonthLabelBilingual(fromMonth);
  return `${hijriMonthLabelBilingual(fromMonth)} → ${hijriMonthLabelBilingual(toMonth)}`;
}

Object.assign(globalThis, {
  exportControlledLedger,
  controlledLedgerRowsForMonths,
  describeExportRange,
});
