import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

/* One archive, one direction.

   request_analytics_archive and request_analytics_summary_v1 were two archives of
   the same orders running side by side: the legacy key held full-detail rows in a
   single Firestore document that grew without bound (the exact problem the summary
   was introduced to solve), two modules still wrote to it, and six read sites
   concatenated both — so one period was served through two different code paths.
   The legacy key is migrated and retired. These tests are what stop it returning. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);

async function sourceFiles() {
  const files = [];
  for (const dir of ['core/', 'modules/', '']) {
    const entries = await readdir(new URL(dir, jsRoot), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      const url = new URL(dir + entry.name, jsRoot);
      files.push({ name: dir + entry.name, source: await readFile(url, 'utf8') });
    }
  }
  return files;
}

const files = await sourceFiles();

test('the retired archive key appears in no shipped source file', async () => {
  // Quoted, i.e. an actual key reference — prose explaining why the key is gone is
  // exactly what should stay, so the next reader does not reintroduce it.
  const quoted = /['"`]request_analytics_archive['"`]/;
  const offenders = files
    .filter(file => quoted.test(file.source))
    // Two files may name it. order-retention.js owns the migration that reads it,
    // stamps it as the export's `source` and deletes it. Module 12 lists it among
    // the measured documents so the migration entry shows in the System Health
    // cleanup panel while the document still exists, and disappears once it does not.
    .filter(file => file.name !== 'core/order-retention.js')
    .filter(file => file.name !== 'modules/12-local-daily-backups-system-health.js')
    .map(file => file.name);
  assert.deepEqual(offenders, []);
});

test('no shipped file still reads or writes the retired key', async () => {
  const offenders = files
    .filter(file => file.name !== 'core/order-retention.js')
    .filter(file => /(?:S\.[gs]|S\.rm)\(\s*['"]request_analytics_archive['"]/.test(file.source))
    .map(file => file.name);
  assert.deepEqual(offenders, []);
});

test('order-retention names the legacy key only in the migration that removes it', async () => {
  const source = files.find(file => file.name === 'core/order-retention.js').source;
  const reads = source.match(/S\.g\(\s*'request_analytics_archive'\s*\)/g) || [];
  const writes = source.match(/S\.s\(\s*'request_analytics_archive'/g) || [];
  const removes = source.match(/S\.rm\(\s*'request_analytics_archive'\s*\)/g) || [];
  assert.equal(writes.length, 0, 'nothing may write to the retired key');
  assert.ok(removes.length >= 1, 'the migration must delete the retired key');
  assert.ok(reads.length >= 1, 'the migration must read it before deleting it');
});

test('the retired key is denied by the security rules and absent from the key catalogue', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.ok(!rules.includes('request_analytics_archive'));
  const keys = await readFile(new URL('./firestore-rules/application-state-keys.js', import.meta.url), 'utf8');
  assert.ok(!keys.includes('request_analytics_archive'));
});

test('archived months carry the counts that keep them in the statistics', async () => {
  const retention = files.find(file => file.name === 'core/order-retention.js').source;
  // An aggregate row standing for many orders must carry what the engine needs to
  // weigh it: how many orders, how many dispensed nothing, how each was filled,
  // and both medicine line sets.
  ['requestCount', 'zeroDispenseCount', 'serviceCounts', 'items:', 'dispensed:'].forEach(field => {
    assert.ok(retention.includes(field), `monthly aggregates must carry ${field}`);
  });
  const engine = files.find(file => file.name === 'core/analytics-engine.js').source;
  assert.match(engine, /export function rowWeight/);
  assert.match(engine, /departments\[dept\]\.orders \+= weight/);
  assert.ok(!/orders: rows\.length/.test(engine), 'order totals must weigh aggregates, not count rows');
});
