import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/* UI whose visibility depends only on cheap, already-known information must not
   wait on an expensive async step. Two icons lagged behind every other one for
   exactly that reason, and both are the same bug wearing different clothes. */

const inventorySafety = await readFile(new URL('../public/assets/js/modules/40-v16-clean-optimized-script.js', import.meta.url), 'utf8');
const subscriptions = await readFile(new URL('../public/assets/js/modules/65-r675-saas-subscriptions-runtime.js', import.meta.url), 'utf8');

test('the Inventory Protection card is placed with the shell, not after the data load', () => {
  // It is master-only and its presence depends on the role alone. It used to be
  // created inside captureBaseline(), which waits for asdh:real-load-complete, so
  // on a warm boot it appeared seconds after everything around it.
  const extension = inventorySafety.indexOf('window.__startAppExtensions.push(function(){');
  const install = inventorySafety.indexOf('ensureSnapshotManager();', extension);
  const capture = inventorySafety.indexOf('function captureBaseline()', extension);
  assert.ok(extension > -1 && install > -1 && capture > -1);
  assert.ok(install < capture, 'the card must be installed before the fingerprint work that waits for data');
});

test('the fingerprint baseline still waits for real data', () => {
  // The card moved; the integrity check did not, because it genuinely needs the
  // loaded inventory to mean anything.
  assert.match(inventorySafety, /asdh:real-load-complete['"]\s*,\s*captureBaseline/);
});

test('the subscriptions tab paints from the last known context for that account', () => {
  // Every other nav icon is static markup. This one waited on getSaasContext, a
  // Cloud Function round trip, so it and the plan-based page gating arrived late.
  assert.match(subscriptions, /var SAAS_CACHE_PREFIX='fs_saas_context_v1_'/);
  assert.match(subscriptions, /function readCachedContext\(uid\)/);
  assert.match(subscriptions, /function writeCachedContext\(uid,data\)/);
  // Applied before the await, corrected after it.
  const cachedApply = subscriptions.indexOf('if(cached){window.FS_PLATFORM_ADMIN=cached.platformAdmin===true');
  const liveCall = subscriptions.indexOf("await callable('getSaasContext')");
  assert.ok(cachedApply > -1 && liveCall > -1);
  assert.ok(cachedApply < liveCall, 'the cached context must be applied before the round trip, not after');
  assert.match(subscriptions, /writeCachedContext\(uid,data\)/);
});

test('the cached context is per account and cannot leak between them', () => {
  // Keyed by uid, and every other account's entry is dropped on write, so a
  // shared device never shows a previous user's plan.
  assert.match(subscriptions, /function saasCacheKey\(uid\)\{return uid\?SAAS_CACHE_PREFIX\+uid:''\}/);
  assert.match(subscriptions, /if\(name\.indexOf\(SAAS_CACHE_PREFIX\)===0&&name!==key\)localStorage\.removeItem\(name\)/);
});
