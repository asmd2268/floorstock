import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { rowsToRotate, rotationPolicies } from '../public/assets/js/core/state-rotation.js';
import { PARTITIONED_STATE_KEYS } from '../public/assets/js/core/partitioned-key-names.js';

/* Every record is prevented from filling up, but not by the same rule.

   Structural: no ceiling at all — rows spread across one document per month and
   a full month rolls to a numbered part. Nothing is dropped. That is what the
   records use, because each of their rows is either evidence someone may have to
   produce or a number a report counts.

   Rotation: a ceiling, with the oldest rows giving way. Right only where an old
   row answers no question — instrumentation, and notices delivered long ago. */

const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

test('the newest rows are kept and the oldest give way', () => {
  const policy = { key: 'k', dateField: ['at'], maxAgeDays: 100 };
  const rows = [
    { id: 'old', at: daysAgo(200) },
    { id: 'new', at: daysAgo(2) },
    { id: 'edge', at: daysAgo(99) },
  ];
  assert.deepEqual(rowsToRotate(rows, policy).map((row) => row.id), ['old']);
});

test('a size ceiling drops oldest first, not whatever it meets first', () => {
  const policy = { key: 'k', dateField: ['at'], maxBytes: 2000 };
  const rows = [
    { id: 'oldest', at: daysAgo(30), blob: 'x'.repeat(900) },
    { id: 'newest', at: daysAgo(1), blob: 'x'.repeat(900) },
    { id: 'middle', at: daysAgo(10), blob: 'x'.repeat(900) },
  ];
  const dropped = rowsToRotate(rows, policy).map((row) => row.id);
  assert.ok(dropped.includes('oldest'));
  assert.ok(!dropped.includes('newest'));
});

test('a row with no readable date is kept, never guessed at', () => {
  const policy = { key: 'k', dateField: ['at'], maxAgeDays: 1 };
  const rows = [{ id: 'undated' }, { id: 'old', at: daysAgo(10) }];
  assert.deepEqual(rowsToRotate(rows, policy).map((row) => row.id), ['old']);
});

test('nothing that is a record or a statistic rotates', () => {
  /* The list is the whole safety argument: a medical record, a regulated
     register or a number a report counts must never be dropped to save room. */
  const rotating = rotationPolicies().map((policy) => policy.key);
  assert.deepEqual(rotating.sort(), ['department_request_notifications_v1', 'user_activity_daily_v1']);
  for (const key of ['requests', 'controlled_moves', 'accountability_usage_v2', 'accountability_receipts_v2',
    'dept_notes', 'deleted_request_audit_v4', 'crash_cart_report_archive', 'controlled_pdf_receipts']) {
    assert.ok(!rotating.includes(key), `${key} must never rotate`);
    // And each of those is uncapped instead — structurally, by month.
    assert.ok(PARTITIONED_STATE_KEYS.includes(key), `${key} must be structurally uncapped`);
  }
});

test('every rotation states why its old rows may go', () => {
  for (const policy of rotationPolicies()) {
    assert.ok(policy.why && policy.why.length > 20, `${policy.key} needs a reason`);
    assert.ok(policy.maxAgeDays || policy.maxBytes, `${policy.key} needs a ceiling`);
  }
});

test('the migrations run themselves, so no record sits in two shapes', async () => {
  /* A key with a legacy document AND month partitions is two versions of one
     record, and which a session read depended on what it held. Left to a button
     it stayed that way. */
  const cleanup = await readFile(new URL('../public/assets/js/core/storage-cleanup.js', import.meta.url), 'utf8');
  assert.match(cleanup, /registerAutoMaintenance\(\{\s*\n\s*key: 'state_month_migrations'/);
  assert.match(cleanup, /await cleaner\.run\(\{ silent: true \}\)/);
});
