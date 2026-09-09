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
      /* Two ways this codebase publishes a global, and counting only the first
         made the budget blind in the direction that matters: forty-five core
         modules publish with Object.assign(globalThis, { … }), which is the
         idiomatic form for new code — so a new module could add a dozen globals
         and the ratchet would report no change at all. */
      for (const match of text.matchAll(/\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) {
        globals.add(match[1]);
      }
      for (const match of text.matchAll(/Object\.assign\(\s*(?:window|globalThis)\s*,\s*\{([\s\S]*?)\}\s*\)/g)) {
        for (const name of match[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*(?::|,|$)/g)) {
          globals.add(name[1]);
        }
      }
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
