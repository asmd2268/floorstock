import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

import { legacyStateDoc, legacyStateDocExists } from '../public/assets/js/core/legacy-state-doc.js';

/* A migration decided it was still pending by asking S.g whether the key held an
   array. After migrating, S.g returns the rows JOINED FROM THE PARTITIONS —
   also an array — so a finished migration looked unfinished, ran again, read its
   own partition rows and appended them back. Production went from 202 orders to
   1,312. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);

test('the legacy document is the raw cache entry, not what S.g returns', () => {
  globalThis.S = { cache: { requests: [{ id: 'a' }], notes: 'not-an-array' } };
  assert.deepEqual(legacyStateDoc('requests'), [{ id: 'a' }]);
  assert.equal(legacyStateDocExists('requests'), true);
  // Migrated: the legacy document is gone, whatever S.g would join together.
  assert.equal(legacyStateDoc('controlled_moves'), null);
  assert.equal(legacyStateDocExists('controlled_moves'), false);
  assert.equal(legacyStateDocExists('notes'), false);
  delete globalThis.S;
});

test('no migration asks S.g whether it still has work', async () => {
  /* This is the exact shape of the bug: Array.isArray(S.g(key)) stays true
     forever once the partitions hold rows. */
  for (const name of await readdir(new URL('core/', jsRoot))) {
    if (!name.endsWith('.js')) continue;
    const source = await readFile(new URL(`core/${name}`, jsRoot), 'utf8');
    const migrationSection = source.includes('kind: \'migration\'') || /migrate\w*ToMonths|migrateKeyToMonths/.test(source);
    if (!migrationSection) continue;
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/Array\.isArray\(\s*globalThis\.S[\s\S]{0,60}?\.g\(/.test(code),
      `${name} decides migration state from S.g; it must read the raw legacy document`);
  }
});

test('the duplicates already written can be removed, and only those', async () => {
  const store = await readFile(new URL('core/month-partitioned-store.js', jsRoot), 'utf8');
  assert.match(store, /export async function dedupeMonthPartitions\(key\)/);
  // The first occurrence is kept; a row with no id is never touched.
  assert.match(store, /if \(!id\) return true;/);
  assert.match(store, /if \(seen\.has\(id\)\) \{ removed \+= 1; return false; \}/);
  // A key with nothing duplicated writes nothing at all.
  assert.match(store, /if \(kept\.length === rows\.length\) continue;/);
});

test('the repair runs itself and is offered as a button', async () => {
  const repair = await readFile(new URL('core/partition-repair.js', jsRoot), 'utf8');
  assert.match(repair, /registerAutoMaintenance\(\{/);
  assert.match(repair, /registerStorageCleanup\(\{/);
  assert.match(repair, /function isMaster\(\)/);
});
