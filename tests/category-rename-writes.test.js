import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from 'acorn';

import { walkAst } from '../tools/lib/published-globals.mjs';

const jsRoot = new URL('../public/assets/js/', import.meta.url);

/* Renaming a category rewrites one Firestore document per department plus two
   settings documents, with no transaction across them. Every one of those
   writes used to be fired and forgotten: the user was told "renamed
   everywhere ✓" whatever happened, and a rejected write left the same category
   spelled two ways across departments — the exact split this project spends
   most of its time undoing. A rejection also went nowhere, so nothing on screen
   or in the console said which department had missed the change. */

test('the category actions await their writes and report what failed', async () => {
  const source = await readFile(new URL('modules/44-ccx-inventory-redesign-script.js', jsRoot), 'utf8');
  assert.match(source, /window\.renameManagedCategory=async function/);
  assert.match(source, /window\.removeManagedCategory=async function/);
  assert.match(source, /window\.moveManagedCategory=async function/);
  assert.match(source, /await saveAllOrReport\(/);
  assert.match(source, /Promise\.allSettled/);
  // Success is claimed by the helper, only when nothing was rejected.
  assert.doesNotMatch(source, /toast\('Category renamed everywhere/);
  assert.doesNotMatch(source, /toast\('Category deleted everywhere/);
  assert.match(source, /Not saved for: /);
});

test('the per-department writes are collected, not fired inside a forEach', async () => {
  const source = await readFile(new URL('modules/44-ccx-inventory-redesign-script.js', jsRoot), 'utf8');
  assert.match(source, /if\(changed\)jobs\.push\(\{label:d\.name\|\|d\.id,run:function\(\)\{return setMeds\(d\.id,ms\)\}\}\)/);
});

/* The general guard: a state write used as a bare statement is a write nobody
   waits for and an error nobody sees. Audit entries are exempt — they are
   deliberately fire-and-forget, and a failed audit entry must never block the
   action it was recording. */
const WRITERS = /^(S\.s|S\.upd|S\.del|setCrashCarts|setCrashReports|setMeds|setExpiry|setCategories|setNotes|setShelves|ctlSetPharmacy|ctlSetDeptList|piSaveMeds|piSaveRooms|piSaveTxns)$/;

function calleeName(node) {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && !node.computed) {
    const object = calleeName(node.object);
    return object ? `${object}.${node.property.name}` : node.property.name;
  }
  return '';
}

test('no state write is fired and forgotten', async () => {
  const offenders = [];
  for (const dir of ['modules', 'core']) {
    const base = new URL(`${dir}/`, jsRoot);
    for (const file of await readdir(base)) {
      if (!file.endsWith('.js')) continue;
      const source = await readFile(new URL(file, base), 'utf8');
      let program;
      try { program = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); } catch { continue; }
      walkAst(program, (node) => {
        if (node.type !== 'ExpressionStatement') return;
        const call = node.expression;
        if (!call || call.type !== 'CallExpression') return;
        if (WRITERS.test(calleeName(call.callee))) offenders.push(`${dir}/${file}:${node.loc.start.line}`);
      });
    }
  }
  assert.deepEqual(offenders, [], 'await the write, or attach a .catch that tells the user');
});
