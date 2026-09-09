import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { hasCapability } from '../public/assets/js/core/role-capabilities.js';

/* A pending Crash Cart report reached the app only through a collection
   listener whose failure went to the console. A master then saw an empty alert
   strip with no way to tell that a department was waiting on them — the same
   view as "no reports at all". */

const stateModule = await readFile(new URL('../public/assets/js/modules/03-core-application-firebase-state-auth.js', import.meta.url), 'utf8');

test('one key has one source: nothing lists alongside a live listener', () => {
  /* The parallel list was drawing the page a second time from a differently
     decoded copy of the same rows. The listener is now installed on every
     transport, so a direct list only runs where there is no listener to defer
     to — after one has failed. */
  assert.match(stateModule, /function fsStateListCollectionKeysOnce\(profile\)/);
  assert.ok(!/fsStateSeedCollectionKeys/.test(stateModule), 'the parallel seed is gone');
  const installer = /function fsStateInstallCollectionListeners\(profile,label\)\{[\s\S]{0,400}?return COLLECTION_BACKED_KEYS/.exec(stateModule);
  assert.ok(installer, 'installer body not found');
  assert.ok(!/fsStateListCollectionKeysOnce/.test(installer[0]), 'the installer must not list in parallel with its own listener');
});

test('a listener failure re-lists the rows and says so out loud', () => {
  assert.match(stateModule, /fallback list failed too/);
  assert.match(stateModule, /Crash Cart reports could not be loaded/);
  // And keeps polling while it is down, so a report submitted meanwhile lands.
  assert.match(stateModule, /__collectionRestFallbackTimer=setInterval/);
});

test('the fallback poll does not outlive its session', () => {
  assert.match(stateModule, /if\(S\.__collectionRestFallbackTimer\)\{clearInterval\(S\.__collectionRestFallbackTimer\)/);
});

test('the roles that can answer a report are exactly four', () => {
  /* Asked directly: who else sees these besides master? Master signs in as
     pharmacy, so it is these four — three of which are scoped roles that read
     by poll rather than by listener. */
  for (const role of ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'outpatient_pharmacy_supervisor']) {
    assert.equal(hasCapability({ role }, 'crashCart.operate'), true, role);
  }
  for (const role of ['department', 'controlled_pharmacy', 'warehouse']) {
    assert.equal(hasCapability({ role }, 'crashCart.operate'), false, role);
  }
  assert.equal(hasCapability({ role: 'master', master: true }, 'crashCart.operate'), true);
});

test('the roles with no key list still get the collection-backed keys', () => {
  /* THE bug: a collection-backed key does not live in the floorstock_state
     collection, so listing that collection returns everything except it. Every
     scoped role merged the collection separately; master and pharmacy — the two
     roles with no key list at all — did not, and loaded zero Crash Cart reports
     on this path. They reach it routinely, because a warm boot opens the cached
     state with transport 'rest'. */
  assert.match(stateModule, /if\(!keys\)return fsStateMergeCollectionKeys\(fsStateLoadFloorstockViaRest\(\),profile\)/);
});

test('the report listener is installed on the REST path as well', () => {
  // Otherwise a warm-booted master waits up to 30s for the next poll to learn
  // that a department is standing at the cart.
  assert.match(stateModule, /if\(globalThis\.FB_DB&&!Array\.isArray\(S\.collectionUnsubs\)\)\{/);
  assert.match(stateModule, /fsStateInstallCollectionListeners\(S\.scopeProfile,'rest-state'\)/);
});

test('an empty alert strip explains itself instead of looking like "no reports"', async () => {
  const crashUi = await readFile(new URL('../public/assets/js/modules/44-ccx-inventory-redesign-script.js', import.meta.url), 'utf8');
  assert.match(crashUi, /No Crash Cart reports have loaded in this session/);
  assert.match(crashUi, /A test role is active/);
  // Counted at each stage a report can be dropped, so the next report of
  // "it does not show for me" is answerable from the page itself.
  assert.match(crashUi, /ccxDrop=\{loaded:reports\.length,notActive:0,otherDept:0,noDeptAccess:0\}/);
  assert.match(crashUi, /dataset\.crashReportsDropped/);
});

test('the fallback list never writes over a listener that recovered', () => {
  /* REST and the SDK decode the same document differently — a timestamp is an
     ISO string over REST and a Timestamp object through the SDK — so two views
     of the identical report are not equal by value. With both writing the key,
     each overwrote the other and every pass scheduled another render: a pharmacy
     account watched the page redraw itself repeatedly. The listener owns the key
     from its first server snapshot; the seed only covers the window before that,
     and stands in while the listener is down. */
  assert.match(stateModule, /S\.__collectionListenerLive\[spec\.key\]=true;/);
  assert.match(stateModule, /if\(!Array\.isArray\(rows\)\|\|S\.__collectionListenerLive\[spec\.key\]\)return;/);
  // A failed listener hands ownership back, or the fallback could never write.
  assert.match(stateModule, /S\.__collectionListenerLive\[spec\.key\]=false;/);
  // And a new session starts with no claim outstanding from the previous one.
  assert.match(stateModule, /S\.__collectionListenerLive=\{\};/);
});

test('a warm boot keeps the reports it already had, so the badge is not late', () => {
  /* A collection-backed key is in no role's key list — it is read from its own
     collection rather than named document by document — so the warm-boot restore
     filtered it out and every session started with an empty Crash Cart badge. A
     pending report was invisible until the listener spoke, seconds later. */
  assert.match(stateModule, /allowed=allowed\.concat\(collectionBackedKeyNames\(\)\);/);
});
