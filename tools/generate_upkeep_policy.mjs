#!/usr/bin/env node
/* Compiles functions/upkeep-policy.json into a browser ES module.

   The same upkeep policy has to be readable by two runtimes that cannot import
   each other: the app is ES modules in a browser, the scheduled job is CommonJS
   in Cloud Functions. Written twice, they agree until somebody edits one — and
   because this policy decides what gets DELETED, the disagreement would show up
   as missing rows months later rather than as an error.

   So the JSON is the authority, the functions require it directly, and this
   writes the browser's copy. The generated file is committed so the app has no
   build step, and `npm run verify` regenerates and fails if it differs. */
import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../functions/upkeep-policy.json', import.meta.url);
const target = new URL('../public/assets/js/core/upkeep-policy.js', import.meta.url);

const policy = JSON.parse(await readFile(source, 'utf8'));
delete policy._comment;

const body = `/* GENERATED FROM functions/upkeep-policy.json — DO NOT EDIT.

   Change a number in that file and run \`npm run verify\`, which regenerates this
   and fails if the two have drifted. The policy decides what gets deleted, and
   two copies of it disagreeing would show up as missing rows months later
   rather than as an error. */

export const UPKEEP_POLICY = Object.freeze(${JSON.stringify(policy, null, 2)
  .split('\n').map((line, index) => (index ? `  ${line}` : line)).join('\n')});

export const ROTATION_POLICIES = UPKEEP_POLICY.rotations;
export const MERGE_HISTORY_POLICIES = UPKEEP_POLICY.mergeHistories;
export const CRASH_REPORT_LIVE_MONTHS = UPKEEP_POLICY.crashReportLiveMonths;

Object.assign(globalThis, { UPKEEP_POLICY });
`;

const existing = await readFile(target, 'utf8').catch(() => null);
if (existing === body) {
  console.log('Upkeep policy module already current.');
} else if (process.argv.includes('--check')) {
  console.error('public/assets/js/core/upkeep-policy.js is out of date with functions/upkeep-policy.json. Run: node tools/generate_upkeep_policy.mjs');
  process.exit(1);
} else {
  await writeFile(target, body);
  console.log('Upkeep policy module regenerated from functions/upkeep-policy.json.');
}
