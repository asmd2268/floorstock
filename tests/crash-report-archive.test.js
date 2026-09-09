import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  reportsReadyToArchive,
  CRASH_REPORT_LIVE_MONTHS,
  CRASH_REPORT_ARCHIVE_KEY,
} from '../public/assets/js/core/crash-report-archive.js';
import { PARTITIONED_STATE_KEYS } from '../public/assets/js/core/partitioned-key-names.js';

/* A Crash Cart report is one document, which is right while it is live. What it
   does not survive is time: Firestore charges per document read and every
   session lists this collection, so a few hundred reports a year becomes several
   thousand reads per login. The same wall the controlled ledger hit, arriving
   more slowly. */

const monthsAgo = (months) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString();
};

test('only closed reports past the window are moved', () => {
  const rows = [
    { id: 'old-closed', status: 'closed', closedAt: monthsAgo(CRASH_REPORT_LIVE_MONTHS + 2), openedAt: monthsAgo(CRASH_REPORT_LIVE_MONTHS + 2) },
    { id: 'recent-closed', status: 'closed', closedAt: monthsAgo(1), openedAt: monthsAgo(1) },
    // Still someone's outstanding work, however old — never moved.
    { id: 'ancient-open', status: 'open', openedAt: monthsAgo(24) },
    { id: 'ancient-pending', status: 'pending', openedAt: monthsAgo(24) },
    { id: 'no-date', status: 'closed' },
    null,
  ];
  assert.deepEqual(reportsReadyToArchive(rows).map((row) => row.id), ['old-closed']);
});

test('a report older than the window falls back to the dates it does have', () => {
  const rows = [{ id: 'a', status: 'closed', lastEditedAt: monthsAgo(CRASH_REPORT_LIVE_MONTHS + 1) }];
  assert.equal(reportsReadyToArchive(rows).length, 1);
  const opened = [{ id: 'b', status: 'closed', openedAt: monthsAgo(CRASH_REPORT_LIVE_MONTHS + 1) }];
  assert.equal(reportsReadyToArchive(opened).length, 1);
});

test('the archive is a registered partitioned key on both permission sources', async () => {
  assert.ok(PARTITIONED_STATE_KEYS.includes(CRASH_REPORT_ARCHIVE_KEY));
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /crash_cart_report_archive/);
});

test('nothing is summarised away, and nothing leaves before it has arrived', async () => {
  /* Archiving must never cost a statistic — a yearly report still counts every
     opening, item and replacement — and a failure must leave the report where it
     was. */
  const source = await readFile(new URL('../public/assets/js/core/crash-report-archive.js', import.meta.url), 'utf8');
  assert.match(source, /await appendMonthPartitionedRows\(CRASH_REPORT_ARCHIVE_KEY, due\);\s*\n\s*await globalThis\.deleteCrashReport/);
  assert.ok(!/summary|totals|aggregate/i.test(source.replace(/summarised away|summarised/g, '')), 'rows are archived whole');
});

test('every reader sees live and archived reports through the one accessor', async () => {
  const module07j = await readFile(new URL('../public/assets/js/modules/07j-controlled-module-enhancements.js', import.meta.url), 'utf8');
  assert.match(module07j, /function crashReports\(\)\{[\s\S]{0,300}?allCrashReports\(\)/);
});

test('it runs itself on a master session, and is offered as a button too', async () => {
  const source = await readFile(new URL('../public/assets/js/core/crash-report-archive.js', import.meta.url), 'utf8');
  assert.match(source, /registerAutoMaintenance\(\{/);
  assert.match(source, /registerStorageCleanup\(\{/);
  // Master only: ten clients must not race to move the same rows.
  assert.match(source, /function isMaster\(\)/);
});
