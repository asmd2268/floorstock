import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { trimMergeHistory, MERGE_HISTORY_BUDGET_BYTES } from '../public/assets/js/core/merge-history-store.js';

/* inventory_name_merge_history reached 120% of the 1 MiB cap in production. It
   was capped at twenty entries — a count, which says nothing about size, because
   undoing a name merge has to restore every affected department's medicine and
   expiry lists and each entry carries a full copy of them. A row count is the
   wrong bound for a record whose rows are not the same size. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);

function entry(id, bytes) {
  return { id, at: `2026-09-0${id}`, canonical: 'X', departments: { icu: 'x'.repeat(bytes) } };
}

test('the newest entries that fit are kept, the oldest dropped', () => {
  const rows = [entry(1, 200 * 1024), entry(2, 200 * 1024), entry(3, 200 * 1024)];
  const kept = trimMergeHistory(rows);
  // Undo always uses the newest, so the newest must survive whatever else does.
  assert.equal(kept[0].id, 1);
  assert.ok(kept.length < rows.length);
  assert.ok(JSON.stringify(kept).length <= MERGE_HISTORY_BUDGET_BYTES);
});

test('an entry too large on its own is kept as a record, without its snapshots', () => {
  /* Refusing to save it would stop the merge itself, which is the failure this
     replaces. Recording who merged what and when, minus the undo payload, keeps
     the merge working and says plainly that it cannot be undone. */
  const huge = entry(1, MERGE_HISTORY_BUDGET_BYTES + 1024);
  const kept = trimMergeHistory([huge, entry(2, 1024)]);
  assert.equal(kept[0].id, 1);
  assert.equal(kept[0].undoUnavailable, true);
  assert.equal(kept[0].departments, undefined);
  assert.equal(kept[0].canonical, 'X');
});

test('a small history is left exactly as it is', () => {
  const rows = [entry(1, 10), entry(2, 10)];
  assert.deepEqual(trimMergeHistory(rows), rows);
});

test('no writer caps the history by row count any more', async () => {
  const inventory = await readFile(new URL('modules/40-v16-clean-optimized-script.js', jsRoot), 'utf8');
  const manual = await readFile(new URL('modules/44-ccx-inventory-redesign-script.js', jsRoot), 'utf8');
  assert.ok(!/history\.length>20/.test(inventory), 'a row count is not a size bound');
  assert.ok(!/hist\.slice\(0,\s*100\)/.test(manual), 'a row count is not a size bound');
  assert.match(inventory, /await saveInventoryMergeHistory\(history\)/);
  assert.match(manual, /await saveManualMergeHistory\(hist\)/);
});

test('the size warning names the action for the document under pressure', async () => {
  /* It told every master to "archive old orders from Requests" whatever the
     document was — which sent them to the wrong screen when a merge history was
     the one at 120%. */
  const health = await readFile(new URL('modules/12-local-daily-backups-system-health.js', jsRoot), 'utf8');
  assert.ok(!/Archive old orders from Requests/.test(health));
  assert.match(health, /storageCleanupFor\(biggest\.key/);
});
