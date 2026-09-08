'use strict';

/* Pure helpers for storing accountability usage one document per Hijri month.

   accountability_usage_v2 was a single floorstock_state document capped at 1 MiB.
   A usage row measures ~688 bytes, so the cap arrives after roughly 1,500 entries
   — two to three months at twenty a day — which cannot carry the five-year
   retention the custody officer must keep. One document per Hijri month holds the
   same data with no ceiling, and costs one read per month instead of one per row.

   Hijri because the pharmacy's custody register is kept in Hijri months, matching
   the controlled movement ledger.

   Everything here is pure so it can be tested without the Admin SDK; the
   transaction plumbing that uses it lives in index.js. */

const USAGE_KEY = 'accountability_usage_v2';

/* '1448-03' from any instant. Returns null rather than guessing: `new Date(null)`
   is the epoch, not an invalid date, so a row with no usable date would otherwise
   be filed under a real month instead of being refused. */
function hijriMonthKeyOf(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  let year = 0;
  let month = 0;
  for (const part of parts) {
    if (part.type === 'year') year = Number(part.value);
    if (part.type === 'month') month = Number(part.value);
  }
  if (!year || !month) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function usagePartitionId(month, part) {
  return (part || 1) <= 1 ? `${USAGE_KEY}_h${month}` : `${USAGE_KEY}_h${month}_p${part}`;
}

/* The Hijri month a usage row lives in. Ids carry their creation time
   (`acc2u_<epoch ms>_<hex>`), so an operation selecting rows by id can read
   exactly the partitions that hold them instead of scanning a window. */
function monthOfUsageId(id) {
  const match = /^acc2u_(\d{10,})_/.exec(String(id || ''));
  if (!match) return null;
  return hijriMonthKeyOf(Number(match[1]));
}

function monthOfUsageRow(row) {
  if (!row) return null;
  return hijriMonthKeyOf(row.submittedAt) || monthOfUsageId(row.id);
}

/* Walks back from `from`, newest first. Used where rows must be found without an
   id to point at the month — the pending-balance check, and assignment deletion. */
function recentHijriMonths(count, from) {
  const start = hijriMonthKeyOf(from || new Date());
  if (!start) return [];
  const [year, month] = start.split('-').map(Number);
  const months = [];
  for (let index = 0; index < Math.max(1, count); index += 1) {
    const total = year * 12 + (month - 1) - index;
    months.push(`${Math.floor(total / 12)}-${String((total % 12 + 12) % 12 + 1).padStart(2, '0')}`);
  }
  return months;
}

/* Groups rows by the partition they belong to. A row's month is fixed at creation
   and never changes, so a partition assignment is stable across edits — an update
   rewrites the row in place rather than moving it between documents. */
function groupRowsByMonth(rows) {
  const grouped = {};
  (rows || []).forEach((row) => {
    const month = monthOfUsageRow(row);
    if (!month) return;
    (grouped[month] = grouped[month] || []).push(row);
  });
  return grouped;
}

function rowsAreEqual(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

/* Distributes the next state of a set of rows back over the partitions that were
   read, and reports which ones actually changed so untouched months are not
   rewritten. `loadedMonths` is what the caller read; anything grouped into a month
   outside that set is returned in `unplaced` so the caller can decide rather than
   losing it silently. */
function planUsageWrites(loadedMonths, loadedRowsByMonth, nextRows) {
  const grouped = groupRowsByMonth(nextRows);
  const writes = [];
  const known = new Set(loadedMonths);
  loadedMonths.forEach((month) => {
    const next = grouped[month] || [];
    if (!rowsAreEqual(loadedRowsByMonth[month] || [], next)) writes.push({ month, rows: next });
  });
  const unplaced = Object.keys(grouped).filter((month) => !known.has(month))
    .map((month) => ({ month, rows: grouped[month] }));
  return { writes, unplaced };
}

module.exports = {
  USAGE_KEY,
  hijriMonthKeyOf,
  usagePartitionId,
  monthOfUsageId,
  monthOfUsageRow,
  recentHijriMonths,
  groupRowsByMonth,
  planUsageWrites,
};
