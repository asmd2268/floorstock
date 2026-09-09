import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

/* Three shapes of layering, all of which hide a defect behind load order. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);

async function sources() {
  const out = [];
  for (const dir of ['core', 'modules']) {
    for (const name of await readdir(new URL(`${dir}/`, jsRoot))) {
      if (!name.endsWith('.js')) continue;
      out.push({ name, text: await readFile(new URL(`${dir}/${name}`, jsRoot), 'utf8') });
    }
  }
  return out;
}

test('no global function is defined in two files', async () => {
  /* Whoever loads last wins, silently — and the two versions had drifted apart:
     one normalised the controlled view before rendering and the other did not,
     so which behaviour ran depended on the import order rather than on anything
     anyone decided. */
  const owners = new Map();
  for (const { name, text } of await sources()) {
    for (const match of text.matchAll(/\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/g)) {
      const key = match[1];
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key).add(name);
    }
  }
  const shared = [...owners.entries()].filter(([, files]) => files.size > 1)
    /* zebraRefreshPrinters is a deliberate hardening override: the production
       build replaces the local-connector version with one that refuses. It is
       listed here so it stays a decision rather than an accident. */
    .filter(([key]) => key !== 'zebraRefreshPrinters')
    .map(([key, files]) => `${key} (${[...files].sort().join(', ')})`);
  assert.deepEqual(shared, []);
});

test('nothing waits on a timer for another module to load', async () => {
  /* ES modules execute in import order, so a global from an earlier import is
     already there. Polling for it was a leftover from concatenated scripts — and
     it failed in silence: after its retry budget it stopped, leaving the
     controlled page without its redesign and nothing saying why. */
  const redesign = await readFile(new URL('modules/80-controlled-pharmacy-ui-redesign.js', jsRoot), 'utf8');
  assert.ok(!/setTimeout\(tryPatch/.test(redesign));
  assert.ok(!/setTimeout\(tryDeptPatch/.test(redesign));
  assert.ok(!/setTimeout\(tryPatchPrint/.test(redesign));
  // A dependency that really is missing is stated once, loudly.
  assert.match(redesign, /console\.error\('\[controlled-redesign\] ' \+ label \+ ' was not installed; missing: '/);
});

test('page-change hooks use the registry instead of wrapping showPg', async () => {
  /* A wrapper makes showPg's identity depend on which module ran last, and a
     failure inside the wrapper takes the page change with it. The registry runs
     each extension in its own try/catch. */
  const operations = await readFile(new URL('modules/50-r617-integrated-operations.js', jsRoot), 'utf8');
  assert.ok(!/window\.showPg=function\(id\)\{orig\.apply/.test(operations));
  assert.match(operations, /window\.__showPgAfterExtensions\.push/);
});
