import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = new URL('..', import.meta.url).pathname;
const checker = path.join(root, 'tools/verify_unresolved_names.mjs');

function run(...args) {
  return execFileSync('node', [checker, ...args], { cwd: root, encoding: 'utf8' });
}

test('no module calls a name the module graph does not define', () => {
  assert.match(run(), /^PASS:/m);
});

test('the check actually fails when a name goes missing', () => {
  /* A guard nobody can break is not a guard. The fixture is a module calling a
     helper that moved out from under it — the exact shape of the two
     ReferenceErrors that shipped. */
  assert.throws(
    () => run('--entry', 'tests/fixtures/unresolved-names/entry.js'),
    (error) => {
      const output = String(error.stderr || error.stdout);
      assert.match(output, /helperThatMovedAway/);
      // The optional global in the same fixture is a question, not a use.
      assert.doesNotMatch(output, /someOptionalGlobal/);
      return true;
    },
  );
});

test('the fixed callers stay fixed', () => {
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  // Each of these threw ReferenceError the moment its screen was used.
  assert.match(read('public/assets/js/modules/07i-misc-features.js'), /'\+allScoped\.length\+'/);
  assert.match(read('public/assets/js/core/controlled-permissions.js'), /function ctlCanEditWarehouse\(\)/);
  // One owner for the controlled permissions: the legacy modules no longer define them.
  assert.doesNotMatch(read('public/assets/js/modules/07j-controlled-module-enhancements.js'), /function ctlCanEdit|function ctlIsMaster/);
  assert.doesNotMatch(read('public/assets/js/modules/03b-controlled-psychotropic-medicines.js'), /function ctlIsOfficer|function ctlIsWarehouse/);
  assert.doesNotMatch(read('public/assets/js/modules/50-r617-integrated-operations.js'), /acc2Bar|acc2AnalyticsTab_REMOVED/);
  assert.doesNotMatch(read('public/assets/js/modules/80-controlled-pharmacy-ui-redesign.js'), /=clone\(crashCarts\(\)\)/);
});

test('a publishLegacy list naming a deleted function is caught', async () => {
  /* This shipped: a function moved to a core module, its name left behind in
     the publishing list as `{ name }`. That is a REFERENCE — the module threw
     at load and every browser test failed with "modules never became ready" —
     but the check counted the same line as a published global and allowed it.
     A file may not satisfy its own reference by publishing it. */
  const source = await import('node:fs').then((fs) => fs.readFileSync(checker, 'utf8'));
  assert.match(source, /!node\.shorthand/, 'shorthand properties are references, not just keys');
  assert.match(source, /publishedElsewhere/);
  assert.match(source, /assignedHere/, 'but window.x = … in the same file still counts');
});
