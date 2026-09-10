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
  // And an unreachable service says so rather than rendering an empty panel —
  // with a way to try again, since a newly created function answers "internal"
  // for the first seconds of its life, which is exactly when this panel is first
  // opened.
  assert.match(ui, /The nightly upkeep could not be reached/);
  assert.match(ui, /data-upkeep="retry"/);
});

test('a failure while drawing cannot leave "Checking…" on screen', async () => {
  /* The panel writes "Checking…" and then draws. Anything thrown in between used
     to leave that message there permanently, which reads as a hang rather than a
     fault. */
  assert.match(ui, /await drawScheduledUpkeep\(host\);/);
  assert.match(ui, /The nightly upkeep panel could not be drawn/);
  /* The escaper is IMPORTED. This test used to demand a local one — and the
     local one was then written as a call to itself, so every draw overflowed
     the stack and the panel disappeared from System Health entirely. A file
     with no escaper of its own cannot repeat that. */
  assert.match(ui, /import \{ fsEsc as escapeText \} from '\.\/dom-utils\.js/);
  assert.doesNotMatch(ui, /function escapeText\(/);
});

test('nothing waits forever: the library load and the call are both bounded', async () => {
  /* script.onerror fires when a request FAILS, not when it never finishes — a
     stalled proxy or a captive portal leaves it pending. fsCallFunction awaits
     the Functions library before EVERY callable, so that stall meant submitting
     a Crash Cart report, a custody mutation or a handover would hang with no
     error, no toast and no failed request to see. */
  const loader = await readFile(new URL('../public/assets/js/core/script-loader.js', import.meta.url), 'utf8');
  assert.match(loader, /const DEFAULT_TIMEOUT_MS = 15000;/);
  assert.match(loader, /did not load within/);
  // And a failed attempt is dropped, so the next one is a fresh request rather
  // than a wait on the promise that already failed.
  assert.match(loader, /if \(error\) pendingScripts\.delete\(key\);/);
  assert.match(ui, /const CALL_TIMEOUT_MS = 20000;/);
  assert.match(ui, /the request timed out/);
});

test('the panel says which build it is running, in every state', async () => {
  /* Three times in one session a screenshot showed behaviour the deployed code
     no longer had, and each time it cost a round trip to establish that the page
     was simply running an older copy. Every module is served with a content hash
     in its URL, so the file can say which one it is. */
  const panel = await readFile(new URL('../public/assets/js/core/scheduled-upkeep-ui.js', import.meta.url), 'utf8');
  assert.match(panel, /const BUILD = \(function \(\) \{/);
  assert.match(panel, /\[?\?&\]v=\(\[0-9a-f\]\+\)/);
  // Checking, unreachable, failed-to-draw, and drawn — all four say it.
  assert.equal((panel.match(/build \$\{escapeText\(BUILD\)\}/g) || []).length, 4);
  assert.match(panel, /console\.info\('\[floorstock\] upkeep panel build', BUILD\)/);
});
