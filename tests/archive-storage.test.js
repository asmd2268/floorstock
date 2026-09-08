import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/* Archives were only ever downloaded to whichever computer ran them — a record
   that survives exactly as long as that machine and its downloads folder. A copy
   is now kept in the project itself: same sign-in, rules deciding who reads it.
   Not a spreadsheet and not email, because the custody archive carries patient
   file numbers, doctors and reasons for dispensing. */

const storageRules = await readFile(new URL('../storage.rules', import.meta.url), 'utf8');
const store = await readFile(new URL('../public/assets/js/core/archive-storage.js', import.meta.url), 'utf8');
const orders = await readFile(new URL('../public/assets/js/core/order-retention.js', import.meta.url), 'utf8');
const moves = await readFile(new URL('../public/assets/js/core/controlled-moves-retention.js', import.meta.url), 'utf8');
const custody = await readFile(new URL('../public/assets/js/core/accountability-retention.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('only an active master can read or write an archive', () => {
  assert.match(storageRules, /function activeMaster\(\)/);
  assert.match(storageRules, /allow read: if activeMaster\(\)/);
  assert.match(storageRules, /allow create: if activeMaster\(\)/);
  // Everything outside the archive path is closed.
  assert.match(storageRules, /match \/\{allPaths=\*\*\} \{\s*allow read, write: if false;/);
});

test('an archive is written once and never overwritten', () => {
  // Overwriting would destroy the only copy of what that file holds.
  assert.match(storageRules, /allow update: if false;/);
});

test('every archive path keeps a copy in the project', () => {
  for (const [name, source] of [['orders', orders], ['controlled movements', moves], ['custody', custody]]) {
    assert.match(source, /uploadArchive\(/, `${name} must upload its archive`);
  }
  // Orders has two call sites: the retention archive and the legacy-archive migration.
  assert.equal((orders.match(/await uploadArchive\(/g) || []).length, 2, 'both order paths upload');
  assert.equal((moves.match(/await uploadArchive\(/g) || []).length, 1);
  assert.equal((custody.match(/await uploadArchive\(/g) || []).length, 1);
});

test('a failed upload never blocks the archive', () => {
  // The master already holds the downloaded file; losing the convenience copy
  // must not stop the operation that produced it.
  assert.match(store, /return \{ ok: false, reason:/);
  assert.ok(!/throw /.test(store.slice(store.indexOf('export async function uploadArchive'), store.indexOf('export async function listStoredArchives'))));
  // And the master is told, rather than left assuming a copy exists.
  for (const source of [orders, moves, custody]) {
    assert.match(source, /could NOT be saved/i);
  }
});

test('the stored copies are listed and downloadable from the app', () => {
    assert.match(store, /export async function listStoredArchives/);
  assert.match(store, /export async function archiveDownloadUrl/);
  assert.match(indexHtml, /id="archive-library-body"/);
  // Each entry carries its own description, so the list reads without opening files.
  assert.match(store, /customMetadata: \{/);
  for (const field of ['kind', 'records', 'coversFrom', 'coversTo', 'savedOn', 'savedBy']) {
    assert.ok(store.includes(`${field}:`), `${field} travels with the stored file`);
  }
});

test('the storage rules are registered for deployment', async () => {
  const config = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
  assert.equal(config.storage.rules, 'storage.rules');
});
