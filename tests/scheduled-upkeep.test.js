import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/* The nightly upkeep deletes rows with nobody watching, so what matters is not
   that it works but that it cannot start doing so quietly. */

const functionsSource = await readFile(new URL('../functions/index.js', import.meta.url), 'utf8');
const ui = await readFile(new URL('../public/assets/js/core/scheduled-upkeep-ui.js', import.meta.url), 'utf8');

test('it is off until someone turns it on, and reports before it removes', () => {
  assert.match(functionsSource, /enabled: data\.enabled === true/);
  assert.match(functionsSource, /dryRun: data\.dryRun !== false/);
  assert.match(functionsSource, /if \(!settings\.enabled\)/);
  // Turning it on always starts in reporting mode, whatever it was before.
  assert.match(ui, /\{ enabled: true, dryRun: true \}/);
  // And leaving reporting mode asks, naming what will actually be removed.
  assert.match(ui, /uiConfirm\(/);
  assert.match(ui, /Records, orders, the controlled register and custody are never touched/);
});

test('the migrations are not on the schedule', () => {
  /* They duplicated production data when they ran unattended, they have already
     run, and a one-time move does not belong on a timer. */
  const scheduled = /for \(const job of \[([^\]]+)\]\)/.exec(functionsSource);
  assert.ok(scheduled, 'the job list was not found');
  assert.deepEqual(scheduled[1].split(',').map((name) => name.trim()),
    ['upkeepRotate', 'upkeepTrimMergeHistories', 'upkeepArchiveCrashReports', 'upkeepDedupe']);
  assert.ok(!/runPendingStorageMigrations|migrateRequestsToMonths/.test(functionsSource));
});

test('every run is written down, and one failed job does not stop the rest', () => {
  assert.match(functionsSource, /await db\.doc\(UPKEEP_SETTINGS_PATH\)\.set\(\{ lastRun: record \}/);
  assert.match(functionsSource, /action: 'system\.scheduled-upkeep'/);
  assert.match(functionsSource, /failures\.push\(\{ tenantId: scope\.tenantId, job: job\.name/);
});

test('archiving writes the month before it removes anything', () => {
  const archive = /async function upkeepArchiveCrashReports[\s\S]*?\n}/.exec(functionsSource)[0];
  const writeAt = archive.indexOf('await ref.set(');
  const deleteAt = archive.indexOf('.delete()');
  assert.ok(writeAt > 0 && deleteAt > writeAt, 'the archive must be written before the collection rows are removed');
});

test('the switch and the last run are visible in the app, not the console', () => {
  assert.match(functionsSource, /exports\.upkeepStatus = onCall/);
  assert.match(functionsSource, /exports\.setUpkeepSettings = onCall/);
  assert.match(functionsSource, /exports\.runUpkeepNow = onCall/);
  // All three are master-only.
  const callables = functionsSource.split('exports.upkeepStatus')[1];
  assert.equal((callables.match(/requireMaster\(caller\)/g) || []).length, 3);
  // And an unreachable service says so rather than rendering an empty panel.
  assert.match(ui, /The nightly upkeep could not be reached/);
});
