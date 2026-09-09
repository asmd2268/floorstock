import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { measure } from '../tools/architecture_budget.mjs';

/* A ratchet, not a cleanup.

   Two structural problems cannot be fixed in one pass: modules talk to each
   other through hundreds of globals rather than imports, and four files carry
   well over a thousand lines each. Both are what a codebase looks like after
   years of growth, and unpicking them means moving thousands of lines through a
   test suite that is mostly source-text assertions — which would not catch a
   behavioural slip while it happened.

   What can be fixed today is the DIRECTION. New work may not add to either
   number, and any reduction is locked in so it cannot be spent again later. The
   recorded budget is architecture-budget.json; `node tools/architecture_budget.mjs
   --update` re-records it after a genuine reduction.

   The tolerance is deliberate: a file may not grow at all, but the global count
   is allowed to sit slightly below its record before the record must be
   tightened, so ordinary work is not interrupted by a two-name improvement. */

const SHRINK_SLACK = 0.05;

const budget = JSON.parse(await readFile(new URL('../architecture-budget.json', import.meta.url), 'utf8'));
const current = await measure();

test('both ways of publishing a global are counted', async () => {
  /* The first version of this budget matched only `globalThis.name =`, while
     forty-five core modules publish with Object.assign(globalThis, { … }) — the
     idiomatic form for new code. A new module could have added a dozen globals
     and the ratchet would have reported no change at all: a guard blind in
     exactly the direction it exists to watch. */
  const tool = await readFile(new URL('../tools/architecture_budget.mjs', import.meta.url), 'utf8');
  assert.match(tool, /Object\\\.assign\\\(\\s\*\(\?:window\|globalThis\)/);
});

test('the global surface does not grow', () => {
  assert.ok(
    current.globals <= budget.globals,
    `${current.globals} globals, budget ${budget.globals}. New modules should export and import rather than assign to window `
    + '— see core/legacy-registry.js for how an existing module publishes one.',
  );
});

test('a real reduction in globals is recorded, so it cannot be spent later', () => {
  const floor = Math.floor(budget.globals * (1 - SHRINK_SLACK));
  assert.ok(
    current.globals >= floor,
    `${current.globals} globals, well under the recorded ${budget.globals}. Lock it in: node tools/architecture_budget.mjs --update`,
  );
});

test('no large module grows', () => {
  const grown = Object.entries(current.modules)
    .filter(([path, lines]) => budget.modules[path] != null && lines > budget.modules[path])
    .map(([path, lines]) => `${path}: ${lines} lines, budget ${budget.modules[path]}`);
  assert.deepEqual(grown, [], 'These files may not grow. Put new behaviour in a new module and import it.');
});

test('a file crossing the threshold is recorded rather than ignored', () => {
  const unlisted = Object.keys(current.modules).filter((path) => budget.modules[path] == null);
  assert.deepEqual(unlisted, [],
    'A module has passed 700 lines. Either split it now, while it is still small enough to split, '
    + 'or record it with: node tools/architecture_budget.mjs --update');
});

test('the budget file describes the current shape, not an aspiration', () => {
  /* If the recorded numbers drift far from reality the ratchet stops meaning
     anything, so the file itself is checked against the code. */
  for (const [path, lines] of Object.entries(budget.modules)) {
    assert.ok(current.modules[path] != null || lines >= 700,
      `${path} is recorded but no longer large; re-record with --update`);
  }
});
