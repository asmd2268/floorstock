import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

/* firestore.rules requires every floorstock_state document to be exactly
   { value, updatedAt } with updatedAt a real timestamp:

     request.resource.data.keys().hasOnly(['value', 'updatedAt'])
       && request.resource.data.updatedAt is timestamp

   The Hijri-month writer sent an ISO string instead, so every partition write was
   refused and both migrations failed with "Cleanup failed — nothing was deleted".
   The rules tests did not catch it because their helper always builds a valid
   Timestamp — they proved the rules were right, never that the client obeys them.
   These tests check the client's own payload shape. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);

async function sources() {
  const out = [];
  for (const dir of ['core/', 'modules/']) {
    for (const name of await readdir(new URL(dir, jsRoot))) {
      if (!name.endsWith('.js')) continue;
      out.push({ name: dir + name, text: await readFile(new URL(dir + name, jsRoot), 'utf8') });
    }
  }
  return out;
}

const files = await sources();

test('the Hijri-month writer stamps a timestamp, not a string', () => {
  const store = files.find(f => f.name === 'core/month-partitioned-store.js').text;
  assert.match(store, /function stateStamp\(\)/);
  assert.match(store, /FieldValue\.serverTimestamp\(\)/);
  // The exact shape the rules demand, and nothing else in the document.
  assert.match(store, /\{ value: next, updatedAt: stateStamp\(\) \}/);
  assert.match(store, /updatedAt: stateStamp\(\)/);
  assert.ok(!/updatedAt: new Date\(\)\.toISOString\(\)/.test(store));
});

test('no client writes a state document with a string timestamp', () => {
  // A state document is recognised by writing { value, updatedAt } together.
  const offenders = [];
  for (const file of files) {
    const pattern = /\{\s*value:[^}]*updatedAt:\s*new Date\(\)\.toISOString\(\)/g;
    if (pattern.test(file.text)) offenders.push(file.name);
  }
  assert.deepEqual(offenders, [], 'these writes would be refused by firestore.rules');
});

test('a failed cleanup says why', () => {
  // "Cleanup failed" alone sent a master to the browser console to find out what
  // Firestore actually rejected.
  const panel = files.find(f => f.name === 'core/storage-cleanup.js').text;
  assert.match(panel, /error\.message \|\| error\.code/);
  assert.match(panel, /failed — nothing was deleted/);
  assert.match(panel, /\$\{reason\}/);
});
