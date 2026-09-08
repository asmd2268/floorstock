import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  ACCOUNTABILITY_RETENTION_MONTHS,
  buildAccountabilityUsageAggregates,
  mergeAccountabilityAggregates,
  olderThanRetention,
} from '../public/assets/js/core/accountability-retention.js';

/* The accountability purge used to DELETE: rows older than six months were
   exported to a file and removed, leaving nothing behind, so every consumption
   figure computed from them dropped to zero the moment a master ran it. These
   tests pin the property that replaced it — archiving costs resolution, not
   totals. */

const usage = [
  { id: 'u1', deptId: 'nicu', medName: 'Morphine 10mg', units: 4, consumptionDate: '2025-03-04', submittedAt: '2025-03-04T08:00:00.000Z', status: 'received_locked' },
  { id: 'u2', deptId: 'nicu', medName: 'Morphine 10mg', units: 6, consumptionDate: '2025-03-19', submittedAt: '2025-03-19T09:00:00.000Z', status: 'received_locked' },
  { id: 'u3', deptId: 'nicu', medName: 'Morphine 10mg', units: 2, consumptionDate: '2025-03-27', submittedAt: '2025-03-27T09:00:00.000Z', status: 'rejected' },
  { id: 'u4', deptId: 'picu', medName: 'Fentanyl 50mcg', units: 5, consumptionDate: '2025-03-11', submittedAt: '2025-03-11T09:00:00.000Z', status: 'received_locked' },
  { id: 'u5', deptId: 'nicu', medName: 'Morphine 10mg', units: 7, consumptionDate: '2025-04-02', submittedAt: '2025-04-02T09:00:00.000Z', status: 'received_locked' },
];

test('units survive archiving in full, grouped by month, department and medicine', () => {
  const rows = buildAccountabilityUsageAggregates(usage);
  assert.equal(rows.length, 3, 'March/nicu, March/picu, April/nicu');
  const total = rows.reduce((sum, row) => sum + row.units, 0);
  assert.equal(total, usage.reduce((sum, row) => sum + row.units, 0));

  const marchNicu = rows.find(r => r.deptId === 'nicu' && r.consumptionDate.startsWith('2025-03'));
  assert.equal(marchNicu.units, 12, '4 + 6 + 2');
  assert.equal(marchNicu.entryCount, 3);
  assert.equal(marchNicu.medName, 'Morphine 10mg');
});

test('the real outcomes are preserved even though the row itself reads as archived', () => {
  const rows = buildAccountabilityUsageAggregates(usage);
  const marchNicu = rows.find(r => r.deptId === 'nicu' && r.consumptionDate.startsWith('2025-03'));
  // Never a live workflow status: the analytics panel counts pending and
  // awaiting-receipt rows, and an archived month must not read as work in progress.
  assert.equal(marchNicu.status, 'archived');
  assert.equal(marchNicu.__aggregated, true);
  assert.equal(marchNicu.statusCounts.received_locked, 2);
  assert.equal(marchNicu.statusCounts.rejected, 1);
});

test('the aggregate is shaped so the month filter and the group-bys need no special case', () => {
  const [row] = buildAccountabilityUsageAggregates([usage[0]]);
  // renderAccAnalytics slices consumptionDate to YYYY-MM and groups on
  // medName / deptId, summing units.
  assert.equal(row.consumptionDate.slice(0, 7), '2025-03');
  assert.ok(row.deptId && row.medName && typeof row.units === 'number');
});

test('running the archive twice adds to a month instead of replacing it', () => {
  const first = buildAccountabilityUsageAggregates(usage.slice(0, 3));
  const second = buildAccountabilityUsageAggregates([
    { id: 'u9', deptId: 'nicu', medName: 'Morphine 10mg', units: 5, consumptionDate: '2025-03-30', submittedAt: '2025-03-30T09:00:00.000Z', status: 'rejected' },
  ]);
  const merged = mergeAccountabilityAggregates(first, second);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].units, 17, '12 from the first run plus 5 from the second');
  assert.equal(merged[0].entryCount, 4);
  assert.equal(merged[0].statusCounts.rejected, 2);
  assert.equal(merged[0].statusCounts.received_locked, 2);
});

test('rows without a usable date are dropped rather than bucketed wrongly', () => {
  assert.deepEqual(buildAccountabilityUsageAggregates([{ id: 'x', units: 3 }]), []);
  assert.deepEqual(buildAccountabilityUsageAggregates([null, undefined]), []);
});

test('the retention cutoff only matches real past dates', () => {
  const cutoff = new Date('2025-06-01').getTime();
  assert.equal(olderThanRetention('2025-03-04T00:00:00.000Z', cutoff), true);
  assert.equal(olderThanRetention('2025-09-04T00:00:00.000Z', cutoff), false);
  // An empty or unparseable value must not read as "very old" and be deleted.
  assert.equal(olderThanRetention('', cutoff), false);
  assert.equal(olderThanRetention(null, cutoff), false);
  assert.equal(olderThanRetention('not a date', cutoff), false);
});

test('the destructive purge is gone and the archive writes the summary first', async () => {
  const source = await readFile(new URL('../public/assets/js/core/accountability-retention.js', import.meta.url), 'utf8');
  const summaryWrite = source.indexOf("S.s(SUMMARY_KEY, summary)");
  const usageTrim = source.indexOf("S.s(USAGE_KEY, usage.filter");
  assert.ok(summaryWrite > -1 && usageTrim > -1);
  assert.ok(summaryWrite < usageTrim, 'totals must be preserved before anything is removed');
  assert.match(source, /S\.s\(SUMMARY_KEY, previousSummary\)/, 'a failed trim must restore the previous summary');

  const module70 = await readFile(new URL('../public/assets/js/modules/70-r676-accountability-regimen-roster-and-log.js', import.meta.url), 'utf8');
  assert.ok(!/keptUsage/.test(module70), 'the inline delete-only purge must be gone');
  assert.match(module70, /window\.acc2PurgeHistoricalHistory=function\(\)\{return window\.archiveAccountabilityHistory\(\)\}/);
});

test('the retention window matches the controlled ledger floor and is owned in one place', async () => {
  // Accountability custody covers controlled medicines, so it carries the same
  // five-year regulatory floor as the movement ledger — not the six-month
  // general-history default it used to inherit.
  assert.equal(ACCOUNTABILITY_RETENTION_MONTHS, 60);

  const panel = await readFile(new URL('../public/assets/js/modules/70-r676-accountability-regimen-roster-and-log.js', import.meta.url), 'utf8');
  // The panel counts what the action would archive, so a second copy of the
  // cutoff there would report a number the button cannot act on.
  assert.ok(!/sixMonthCutoff|olderThanSixMonths/.test(panel), 'the panel must not carry its own cutoff');
  assert.match(panel, /window\.ACCOUNTABILITY_RETENTION_MONTHS/);
});
