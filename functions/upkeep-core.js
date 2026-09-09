'use strict';

/* Pure planning for the scheduled upkeep. No Admin SDK here, so every rule
   below can be tested without a database — which matters more for this file
   than for most: it decides what gets deleted, on a schedule, with nobody
   watching.

   Three principles it is built on, each of them learned the hard way:

     idempotent — running twice must change nothing the second time. The
                  migration that duplicated 101 orders into 1,312 failed exactly
                  this test.
     bounded    — a job may only touch the rows its own declared policy names.
                  There is no "clean up whatever looks old".
     reportable — every run returns what it did, and the caller writes that down.
                  Silent upkeep is indistinguishable from upkeep that never ran. */

/* Only these two rotate, and only these two may ever be added to without a
   deliberate decision: instrumentation, and notices that were delivered long
   ago. Records, statistics and anything a regulator may ask for are absent on
   purpose — see core/state-rotation.js for the same list on the client. */
const ROTATIONS = Object.freeze([
  Object.freeze({ key: 'user_activity_daily_v1', dateFields: ['date'], maxAgeDays: 400 }),
  Object.freeze({ key: 'department_request_notifications_v1', dateFields: ['createdAt'], maxAgeDays: 180 }),
]);

const MERGE_HISTORIES = Object.freeze([
  Object.freeze({ key: 'inventory_name_merge_history', maxBytes: 300 * 1024 }),
  Object.freeze({ key: 'manual_medicine_merge_history_v1', maxBytes: 300 * 1024 }),
]);

const CRASH_REPORT_LIVE_MONTHS = 6;
const CRASH_REPORT_ARCHIVE_KEY = 'crash_cart_report_archive';

function isoDaysAgo(days, now) {
  return new Date((now ? now.getTime() : Date.now()) - days * 86400000).toISOString();
}

function firstDate(row, fields) {
  for (const field of fields) {
    const value = row && row[field];
    if (value) return String(value);
  }
  return '';
}

function gregorianMonthKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/* The rows a rotation keeps. A row with no readable date is KEPT: it cannot be
   judged old, and guessing would delete it on the first pass. */
function rotateRows(rows, policy, now) {
  const cutoff = isoDaysAgo(policy.maxAgeDays, now);
  const kept = [];
  let dropped = 0;
  (rows || []).forEach((row) => {
    const at = firstDate(row, policy.dateFields);
    if (at && at < cutoff) { dropped += 1; return; }
    kept.push(row);
  });
  return { kept, dropped };
}

/* A whole partition older than the cutoff can go without reading its rows —
   `<key>_gYYYY-MM` names the month it holds. Returns null when the id does not
   parse, so an unexpected document is never deleted on a guess. */
function partitionMonthIsExpired(docId, key, policy, now) {
  const match = new RegExp(`^${key}_g(\\d{4})-(\\d{2})(?:_p\\d+)?$`).exec(String(docId || ''));
  if (!match) return null;
  const lastDayOfMonth = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0, 23, 59, 59));
  return lastDayOfMonth.toISOString() < isoDaysAgo(policy.maxAgeDays, now);
}

/* Newest first, keeping entries while they fit. An entry too large on its own is
   kept, without the snapshots that made it huge — a merge that cannot be undone
   is still worth recording. */
function trimToBudget(rows, maxBytes) {
  const kept = [];
  let used = 0;
  let dropped = 0;
  (rows || []).forEach((row) => {
    if (!row) return;
    let entry = row;
    let size = Buffer.byteLength(JSON.stringify(entry), 'utf8');
    if (!kept.length && size > maxBytes) {
      entry = Object.assign({}, entry, { undoUnavailable: true });
      delete entry.departments;
      delete entry.expiry;
      delete entry.records;
      size = Buffer.byteLength(JSON.stringify(entry), 'utf8');
    }
    if (kept.length && used + size > maxBytes) { dropped += 1; return; }
    kept.push(entry);
    used += size;
  });
  return { kept, dropped };
}

/* Closed and past the window. Open or pending is never archived, however old:
   it is still somebody's outstanding work. */
function reportsToArchive(reports, now, months) {
  const cutoff = new Date(now ? now.getTime() : Date.now());
  cutoff.setMonth(cutoff.getMonth() - (months || CRASH_REPORT_LIVE_MONTHS));
  const iso = cutoff.toISOString();
  return (reports || []).filter((row) => {
    if (!row || !row.id || row.status !== 'closed') return false;
    const at = firstDate(row, ['closedAt', 'lastEditedAt', 'openedAt']);
    return !!at && at < iso;
  });
}

function groupByGregorianMonth(rows, fields) {
  const grouped = {};
  (rows || []).forEach((row) => {
    const month = gregorianMonthKey(firstDate(row, fields));
    if (!month) return;
    (grouped[month] = grouped[month] || []).push(row);
  });
  return grouped;
}

/* Rows whose id has already been seen, plus — for ids this project invented for
   rows that arrived without one — rows whose CONTENT has already been seen. A
   row that came with its own id keeps its identity whatever it holds. */
function planDedupe(rowsByDoc) {
  const seenIds = new Set();
  const seenPrints = new Set();
  const writes = {};
  let removed = 0;
  Object.keys(rowsByDoc || {}).sort().forEach((docId) => {
    const rows = rowsByDoc[docId] || [];
    const kept = rows.filter((row) => {
      const id = row && row.id != null ? String(row.id) : null;
      if (!id) return true;
      if (seenIds.has(id)) { removed += 1; return false; }
      if (/_migrated_[a-z0-9]+$/i.test(id)) {
        const copy = Object.assign({}, row);
        delete copy.id;
        delete copy.migratedWithoutDate;
        const print = JSON.stringify(copy);
        if (seenPrints.has(print)) { removed += 1; return false; }
        seenPrints.add(print);
      }
      seenIds.add(id);
      return true;
    });
    if (kept.length !== rows.length) writes[docId] = kept;
  });
  return { writes, removed };
}

module.exports = {
  ROTATIONS,
  MERGE_HISTORIES,
  CRASH_REPORT_LIVE_MONTHS,
  CRASH_REPORT_ARCHIVE_KEY,
  gregorianMonthKey,
  rotateRows,
  partitionMonthIsExpired,
  trimToBudget,
  reportsToArchive,
  groupByGregorianMonth,
  planDedupe,
};
