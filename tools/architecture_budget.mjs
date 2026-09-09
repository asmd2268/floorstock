#!/usr/bin/env node
/* Measures the two structural numbers this project is trying to reduce, and
   records them so they can only go down.

   Neither can be fixed in one pass: 701 globals and four modules over 1,700
   lines are the shape of a codebase that grew for years, and unpicking them
   means moving thousands of lines through tests that are mostly source-text
   assertions. What CAN be fixed today is the direction — new work stops adding
   to either, and every reduction is locked in so it cannot be spent later.

   Run with --update to record the current numbers (after a real reduction).   */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { parse } from 'acorn';

import { collectPublishedGlobals } from './lib/published-globals.mjs';

const jsRoot = new URL('../public/assets/js/', import.meta.url);
const budgetPath = new URL('../architecture-budget.json', import.meta.url);

export async function measure() {
  const globals = new Set();
  const modules = {};
  for (const dir of ['core', 'modules']) {
    for (const name of await readdir(new URL(`${dir}/`, jsRoot))) {
      if (!name.endsWith('.js')) continue;
      const path = `${dir}/${name}`;
      const text = await readFile(new URL(path, jsRoot), 'utf8');
      /* Three ways this codebase publishes a global, and counting a subset is
         how this number lied twice: first it saw only `window.x =` while forty-five
         core modules used Object.assign(globalThis, { … }), and then it still
         missed publishLegacy, which assigns every key of a legacy module's api
         object. One collector now knows all three — see tools/lib. */
      try { collectPublishedGlobals(parse(text, { ecmaVersion: 'latest', sourceType: 'module' }), globals); }
      catch { /* A file acorn cannot parse is reported by verify_modules, not here. */ }
      const lines = text.split('\n').length;
      if (lines >= 700) modules[path] = lines;
    }
  }
  return { globals: globals.size, modules };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const current = await measure();
  if (process.argv.includes('--update')) {
    await writeFile(budgetPath, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`Recorded: ${current.globals} globals, ${Object.keys(current.modules).length} large modules.`);
  } else {
    console.log(JSON.stringify(current, null, 2));
  }
}
