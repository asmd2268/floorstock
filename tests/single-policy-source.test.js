import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { createRequire } from 'node:module';

import { ROTATION_POLICIES, MERGE_HISTORY_POLICIES, CRASH_REPORT_LIVE_MONTHS } from '../public/assets/js/core/upkeep-policy.js';

const require = createRequire(import.meta.url);
const functionsCore = require('../functions/upkeep-core.js');
const jsRoot = new URL('../public/assets/js/', import.meta.url);

/* The upkeep policy decides what gets DELETED, and it has to be readable by two
   runtimes that cannot import each other: ES modules in the browser, CommonJS in
   Cloud Functions. Written out in both, they agree until somebody edits one —
   and then the browser keeps rows the schedule removes, which surfaces as
   missing data months later rather than as an error. */

test('both runtimes read the same numbers', () => {
  assert.deepEqual(
    ROTATION_POLICIES.map((policy) => [policy.key, policy.maxAgeDays]),
    functionsCore.ROTATIONS.map((policy) => [policy.key, policy.maxAgeDays]),
  );
  assert.deepEqual(
    MERGE_HISTORY_POLICIES.map((policy) => [policy.key, policy.maxBytes]),
    functionsCore.MERGE_HISTORIES.map((policy) => [policy.key, policy.maxBytes]),
  );
  assert.equal(CRASH_REPORT_LIVE_MONTHS, functionsCore.CRASH_REPORT_LIVE_MONTHS);
});

test('the browser module is generated, not hand-written', async () => {
  const generated = await readFile(new URL('core/upkeep-policy.js', jsRoot), 'utf8');
  assert.match(generated, /GENERATED FROM functions\/upkeep-policy\.json — DO NOT EDIT/);
  // npm run verify regenerates and fails if the committed copy has drifted.
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(packageJson.scripts.verify, /generate_upkeep_policy\.mjs --check/);
});

test('no consumer writes a policy number of its own', async () => {
  /* The exact shape of the fault: a literal 400 or 300 * 1024 somewhere else,
     agreeing today and silently disagreeing after the first edit. */
  const consumers = ['core/state-rotation.js', 'core/merge-history-store.js', 'core/crash-report-archive.js'];
  for (const file of consumers) {
    const source = await readFile(new URL(file, jsRoot), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/maxAgeDays:\s*\d/.test(code), `${file} declares its own age limit`);
    assert.ok(!/300 \* 1024|409600|307200/.test(code), `${file} declares its own byte budget`);
    assert.ok(!/LIVE_MONTHS = \d/.test(code), `${file} declares its own window`);
    assert.match(source, /upkeep-policy\.js/, `${file} must read the shared policy`);
  }
});

test('what may rotate is still only instrumentation', async () => {
  /* Moving the numbers into one file must not quietly widen what they apply to. */
  assert.deepEqual(ROTATION_POLICIES.map((policy) => policy.key).sort(),
    ['department_request_notifications_v1', 'user_activity_daily_v1']);
  for (const policy of ROTATION_POLICIES) {
    assert.ok(policy.why && policy.why.length > 20, `${policy.key} needs a written reason`);
    assert.ok(policy.maxAgeDays || policy.maxBytes, `${policy.key} needs a ceiling`);
  }
});
