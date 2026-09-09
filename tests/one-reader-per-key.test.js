import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

/* Two ways the same fact came to be read from two places, both of which put
   wrong numbers on screen for a pharmacy account while master saw the right
   ones:

   1. A role's state was LOADED from one key list and LISTENED to from another.
      A poll applies its result with fsStateApplyCache, which deletes any key the
      poll did not return — so every poll wiped the month partitions the
      listeners had just delivered, and the pending-custody badge counted 2, then
      0, then 2.

   2. Five call sites re-implemented "are this key's rows in month partitions
      yet, or still in the legacy document?" by calling monthPartitionRows
      directly. S.g owns that decision; a copy of it disagrees with the original
      the whole time the legacy record is still live. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);
const stateModule = await readFile(new URL('modules/03-core-application-firebase-state-auth.js', jsRoot), 'utf8');

test('a role loads exactly the keys it listens to', () => {
  assert.match(stateModule, /var restKeys=\(fsStateKeysForProfile\(profile\)\|\|PHARMACY_SCOPED_STATE_KEYS\)/);
  assert.match(stateModule, /fsStateLoadScoped\(fsStateKeysForProfile\(profile\)\|\|CONTROLLED_PHARMACY_BASE_KEYS/);
  // The scoped loaders must not build their own list from a raw constant, or the
  // poll starts deleting what the listeners deliver.
  assert.ok(!/fsStateLoadScoped\(CONTROLLED_PHARMACY_BASE_KEYS/.test(stateModule));
  assert.ok(!/var restKeys=PHARMACY_SCOPED_STATE_KEYS\.filter/.test(stateModule));
});

test('only the state module decides where a partitioned key is read from', async () => {
  /* Exactly the bug that emptied every order screen once before, via gr(). S.g
     is the one place that knows; everywhere else asks S.g. */
  const allowed = new Set([
    'core/month-partitioned-store.js',
    'core/requests-store.js',
    'core/controlled-moves-store.js',
    'modules/03-core-application-firebase-state-auth.js',
  ]);
  for (const dir of ['core', 'modules']) {
    for (const name of await readdir(new URL(`${dir}/`, jsRoot))) {
      if (!name.endsWith('.js')) continue;
      const path = `${dir}/${name}`;
      if (allowed.has(path)) continue;
      const code = (await readFile(new URL(path, jsRoot), 'utf8'))
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      assert.ok(!/monthPartitionRows\s*\(/.test(code), `${path} re-implements the partitioned-or-legacy decision; read through S.g`);
    }
  }
});

test('the pending-custody badge and the page it counts read the same way', async () => {
  const badges = await readFile(new URL('modules/80-controlled-pharmacy-ui-redesign.js', jsRoot), 'utf8');
  const page = await readFile(new URL('modules/50-r617-integrated-operations.js', jsRoot), 'utf8');
  assert.match(badges, /S\.g\('accountability_usage_v2'\)/);
  assert.match(page, /function acc2Array\(key\)\{[\s\S]{0,400}?var value=S\.g\(key\)/);
});

test('a key resolves to the same place for every role', () => {
  /* S.g decides where a key's rows live by asking whether the legacy document is
     in the session cache — so the answer used to depend on WHO was asking.
     Master lists the whole collection and held it, and read the legacy record; a
     scoped role never requested it and read the month partitions instead. One
     key, two roles, two different sets of rows: a badge showed 2 for master and
     something else for the pharmacy account, permanently. Every role now holds
     the legacy document, so every role reaches the same answer. */
  assert.match(stateModule, /keys\.push\(key\);\s*\n\s*keys=keys\.concat\(recentPartitionKeys\(key,months\)\)/);
  // Named twice — in a role's static list and as a partitioned base key — must
  // still be read once.
  assert.match(stateModule, /function fsUniqueKeys\(keys\)/);
  assert.match(stateModule, /return keys\?fsUniqueKeys\(keys\):keys/);
});

test('a scoped session draws once its opening snapshots have landed', () => {
  /* ~40 per-document listeners each delivering on their own schedule, each
     asking for a render, meant the page was drawn repeatedly from different
     half-arrived states. Master reads one collection snapshot and never saw it. */
  assert.match(stateModule, /var openingWave=keys\.length,waveSettled=false/);
  assert.match(stateModule, /if\(changed&&waveSettled\)S\.scheduleRefresh\(\)/);
  // A slow or denied document must not hold the page back forever.
  assert.match(stateModule, /waveDeadline=setTimeout\(function\(\)\{finishWave\(\)\},2500\)/);
  // A listener that errors still counts as having spoken.
  assert.match(stateModule, /\},function\(error\)\{\s*\n\s*if\(first\)\{first=false;waveArrived\(\);\}/);
  // The collection listener waits for the same wave.
  assert.match(stateModule, /function fsRefreshWhenSettled\(\)/);
  // And the gate is dropped with the listeners it belongs to.
  assert.match(stateModule, /S\.__scopedWaveComplete=null;/);
});
