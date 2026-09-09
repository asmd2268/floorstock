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

test('a row that arrived without an id gets the same id every time', async () => {
  /* Random ids are why 202 orders were still 830 after the id-matched duplicates
     were removed: the same order imported twice became two rows that no id
     comparison could pair. */
  const { stableRowId, stableRowFingerprint, isSynthesizedMigrationId } = await import('../public/assets/js/core/row-fingerprint.js');
  const row = { dept: 'icu', created: '2026-01-01T00:00:00.000Z', items: [{ med: 'a', qty: 2 }] };
  const again = { created: '2026-01-01T00:00:00.000Z', items: [{ qty: 2, med: 'a' }], dept: 'icu' };
  assert.equal(stableRowId('req', row), stableRowId('req', again), 'field order must not change identity');
  assert.notEqual(stableRowId('req', row), stableRowId('req', { ...row, dept: 'er' }));
  // The id and the migration flag are not part of what makes a row itself.
  assert.equal(stableRowFingerprint({ ...row, id: 'x' }), stableRowFingerprint({ ...row, id: 'y', migratedWithoutDate: true }));
  assert.equal(isSynthesizedMigrationId('req_migrated_1a2b3c'), true);
  assert.equal(isSynthesizedMigrationId('req_1757000000000_ab12'), false);
});

test('no migration invents a random identity', async () => {
  for (const name of ['requests-store.js', 'operational-partitions.js']) {
    const source = await readFile(new URL(`core/${name}`, jsRoot), 'utf8');
    assert.ok(!/_migrated_\$\{index\}_\$\{Math\.random/.test(source), `${name} still invents random ids`);
    assert.match(source, /stableRowId\(/);
  }
});

test('content matching applies only to ids this project invented', async () => {
  /* A row that came with its own id keeps its identity whatever it holds — two
     real orders may legitimately look alike. */
  const store = await readFile(new URL('core/month-partitioned-store.js', jsRoot), 'utf8');
  assert.match(store, /if \(isSynthesizedMigrationId\(id\)\) \{/);
  // And the repair reports per key, before and after, since a total alone cannot
  // say whether a record is back to its real size.
  const repair = await readFile(new URL('core/partition-repair.js', jsRoot), 'utf8');
  assert.match(repair, /\$\{entry\.key\} \$\{entry\.before\}→\$\{entry\.after\}/);
});
