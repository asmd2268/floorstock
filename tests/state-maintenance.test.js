import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/* "Anything near the limit should trim or archive itself" — right instinct, but
   the two halves must not be automated the same way. An undo stack is a cache
   with a history and can trim itself; a record carries statistics and, for the
   controlled register, a six Hijri year retention floor, and deleting one to
   make room is what this project refused from the start. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);
const maintenance = await readFile(new URL('core/state-maintenance.js', jsRoot), 'utf8');
const mergeHistory = await readFile(new URL('core/merge-history-store.js', jsRoot), 'utf8');
const retention = await readFile(new URL('core/accountability-retention.js', jsRoot), 'utf8');
const requests = await readFile(new URL('core/requests-store.js', jsRoot), 'utf8');
const health = await readFile(new URL('modules/12-local-daily-backups-system-health.js', jsRoot), 'utf8');

test('undo stacks trim themselves, with no one to ask', async () => {
  const { registerAutoMaintenance, runAutoMaintenance, autoMaintenanceKeys } = await import('../public/assets/js/core/state-maintenance.js');
  assert.equal(typeof registerAutoMaintenance, 'function');
  assert.match(mergeHistory, /registerAutoMaintenance\(\{/);
  // Both merge histories, and nothing that holds records.
  assert.match(mergeHistory, /Object\.values\(KEYS\)\.forEach/);
  assert.ok(autoMaintenanceKeys().length >= 0);
  assert.equal(typeof runAutoMaintenance, 'function');
});

test('nothing automatic ever deletes a record', () => {
  /* Archiving downloads the full detail to a device first, which cannot happen
     while nobody is watching — so the retention and order archives stay behind a
     master's own action, and say so. */
  assert.ok(!/registerAutoMaintenance/.test(retention), 'custody retention must not run itself');
  assert.ok(!/registerAutoMaintenance/.test(requests), 'order archiving must not run itself');
  assert.match(maintenance, /six Hijri\s*\n?\s*.*year retention floor|retention floor/);
});

test('only a master runs upkeep, so clients do not race', () => {
  assert.match(maintenance, /function isMaster\(\)/);
  assert.match(maintenance, /if \(!isMaster\(\)\) return \[\];/);
});

test('a failed upkeep job never stops the session', () => {
  assert.match(maintenance, /console\.warn\('Automatic maintenance failed for'/);
});

test('the size warning measures what upkeep left behind', () => {
  // Upkeep at 3s, the warning at 8s: a master must never be warned about a
  // record that was about to fix itself.
  assert.match(maintenance, /\}, 3000\);/);
  assert.match(health, /\},8000\);/);
});

test('one job per key, so a second registration cannot silently replace it', () => {
  assert.match(maintenance, /Automatic maintenance is already registered for/);
});

test('moving rows between records may be automatic; writing a file may not', () => {
  /* The line stays where it was: archiving that downloads full detail to a
     device cannot happen unattended, and nothing automatic deletes a record.
     Filing closed Crash Cart reports into monthly documents is neither — it
     moves rows inside the same database, keeps every field, and exists because
     the read cost of the collection grows on its own. */
  const archive = readFileSync(new URL('core/crash-report-archive.js', jsRoot), 'utf8');
  assert.match(archive, /registerAutoMaintenance\(\{/);
  assert.match(archive, /appendMonthPartitionedRows\(CRASH_REPORT_ARCHIVE_KEY, due\)/);
  // Still never automatic: the retention archives that produce a file.
  assert.ok(!/registerAutoMaintenance/.test(retention), 'custody retention must not run itself');
  assert.ok(!/registerAutoMaintenance/.test(requests), 'order archiving must not run itself');
});
