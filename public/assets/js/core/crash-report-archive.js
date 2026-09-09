import {
  registerMonthPartitionedKey,
  appendMonthPartitionedRows,
  monthPartitionRows,
  partitionKeysInCache,
} from './month-partitioned-store.js?v=405d877017';
import { registerAutoMaintenance } from './state-maintenance.js?v=3b19eb92e8';
import { registerStorageCleanup } from './storage-cleanup.js?v=48f4075c4b';

/* Crash Cart reports, kept affordable forever.

   A report is one document, which is the right shape while a report is live: it
   is written by a Cloud Function, read individually, and never fills up. What it
   does not survive is TIME. Firestore charges per document read, and every
   session lists this collection — so one cart opening per ward per week is a few
   hundred documents a year, and after five years every login pays several
   thousand reads before it draws anything. That is the same wall the controlled
   ledger hit, arriving more slowly.

   So the collection holds what is current — everything open or pending, and
   every report closed within the retention window — and older closed reports are
   moved into one document per Gregorian month. Sixty documents carry five years
   instead of several thousand, and the rows themselves are untouched: nothing is
   summarised away, so a yearly report still counts every opening, every
   consumed item and every replacement.

   Reports stay whole in another sense too. Archiving copies them into their
   month first and removes the collection documents only after that write has
   succeeded, so a failure at any point leaves the report exactly where it was. */

export const CRASH_REPORT_ARCHIVE_KEY = 'crash_cart_report_archive';
export const CRASH_REPORT_LIVE_MONTHS = 6;

registerMonthPartitionedKey({
  key: CRASH_REPORT_ARCHIVE_KEY,
  calendar: 'gregorian',
  // Filed by when the cart was opened — the date the report is about.
  dateField: ['openedAt', 'closedAt', 'lastEditedAt'],
  sortField: 'openedAt',
  // A pharmacy screen shows recent activity; older months are for the yearly
  // reports a master runs, and master lists the whole state collection anyway.
  sessionMonths: 2,
});

function isMaster() {
  return !!(globalThis.CU && globalThis.CU.master === true);
}

function liveReports() {
  const rows = globalThis.S && typeof globalThis.S.g === 'function' ? globalThis.S.g('crash_cart_reports') : null;
  return Array.isArray(rows) ? rows : [];
}

export function archivedReports() {
  return monthPartitionRows(CRASH_REPORT_ARCHIVE_KEY) || [];
}

/* Live plus archived, without duplicates — the archive is written before the
   collection rows are removed, so both hold the same report for a moment. */
export function allCrashReports() {
  const live = liveReports();
  if (!partitionKeysInCache(CRASH_REPORT_ARCHIVE_KEY).length) return live;
  const seen = new Set(live.map((row) => String(row && row.id)));
  return live.concat(archivedReports().filter((row) => row && !seen.has(String(row.id))));
}

function cutoffIso(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - (months || CRASH_REPORT_LIVE_MONTHS));
  return date.toISOString();
}

/* Closed and older than the window. An open or pending report is never moved,
   however old: it is still someone's outstanding work. */
export function reportsReadyToArchive(rows, months) {
  const cutoff = cutoffIso(months);
  return (rows || []).filter((row) => {
    if (!row || !row.id) return false;
    if (row.status !== 'closed') return false;
    const at = String(row.closedAt || row.lastEditedAt || row.openedAt || '');
    return !!at && at < cutoff;
  });
}

export async function archiveOldCrashReports({ silent } = {}) {
  if (!isMaster()) {
    if (!silent) globalThis.toast('Only Master can archive Crash Cart reports.', 'err');
    return null;
  }
  const due = reportsReadyToArchive(liveReports());
  if (!due.length) return null;

  if (!silent) {
    const months = [...new Set(due.map((row) => String(row.openedAt || '').slice(0, 7)))].filter(Boolean).sort();
    const confirmed = await globalThis.uiConfirm(
      `${due.length} closed report(s) older than ${CRASH_REPORT_LIVE_MONTHS} months will be filed into ${months.length} monthly record(s), ${months[0]} to ${months[months.length - 1]}.\n\n`
      + 'Every field is kept, so yearly reports still count them. They leave the live list only after they exist in their month.\n\n'
      + `سيتم ترحيل ${due.length} بلاغاً مغلقاً إلى ${months.length} سجل شهري مع كل تفاصيلها، ولن تُحذف من القائمة الحية إلا بعد نجاح النسخ.`,
      { okText: 'Archive / أرشفة' },
    );
    if (!confirmed) { globalThis.toast('Nothing was changed.', 'info'); return null; }
  }

  // Copy first. A failure here leaves every report exactly where it was.
  await appendMonthPartitionedRows(CRASH_REPORT_ARCHIVE_KEY, due);
  await globalThis.deleteCrashReport(due.map((row) => String(row.id)));
  return { archived: due.length };
}

/* Runs itself on a master session, because leaving it to be noticed is how the
   read cost grows unattended — and unlike an archive that writes a file, this
   one moves rows between two records inside the same database, with nothing to
   download and nothing lost. */
registerAutoMaintenance({
  key: CRASH_REPORT_ARCHIVE_KEY,
  describe: (result) => `${result.archived} closed Crash Cart report(s) filed by month`,
  run: () => archiveOldCrashReports({ silent: true }),
});

registerStorageCleanup({
  key: 'crash_cart_reports',
  label: 'Archive closed reports / أرشفة البلاغات المغلقة',
  hint: `Files closed reports older than ${CRASH_REPORT_LIVE_MONTHS} months into one record per month, so the number of documents a session reads stops growing. Every field is kept.`,
  run: () => archiveOldCrashReports({}),
  canRun: () => isMaster(),
});

Object.assign(globalThis, {
  CRASH_REPORT_ARCHIVE_KEY,
  archivedReports,
  allCrashReports,
  reportsReadyToArchive,
  archiveOldCrashReports,
});
