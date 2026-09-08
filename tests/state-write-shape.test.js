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

test('the size gauge measures every state document, not a hand-kept list', async () => {
  /* It watched eight named keys while the application has more than fifty, so a
     record nobody thought to add — notes, dept_notes, the deleted-request audit —
     could grow to the cap unseen. A list written today also goes stale the first
     time a feature adds a key. */
  const health = files.find(f => f.name === 'modules/12-local-daily-backups-system-health.js').text;
  assert.ok(!/SIZE_WATCHED_KEYS/.test(health), 'the fixed watch list must be gone');
  assert.match(health, /Object\.keys\(window\.S\.cache\)/);
  assert.match(health, /NEVER_MEASURED/);
  // Partitioned families are folded into one row rather than listed month by month.
  assert.match(health, /function foldedKeys\(\)/);
  assert.match(health, /function auditLogFamilyRow\(/);
});

test('the gauge orders by closeness to the cap, not by size', () => {
  /* The login-time warning reads the first row. A ledger's bytes are a total
     across months while a plain document's are one document, so a byte sort could
     put a 30%-full ledger above a record at 90% and miss it entirely. */
  const health = files.find(f => f.name === 'modules/12-local-daily-backups-system-health.js').text;
  assert.match(health, /\(b\.pct-a\.pct\)\|\|\(b\.bytes-a\.bytes\)/);
  assert.match(health, /biggest\.pct<70/, 'the warning still fires from the first row');
});
