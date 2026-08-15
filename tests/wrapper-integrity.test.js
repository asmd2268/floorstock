import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const crashSource = await readFile(new URL('../public/assets/js/modules/44-ccx-inventory-redesign-script.js', import.meta.url), 'utf8');
const authSource = await readFile(new URL('../public/assets/js/modules/70-r676-accountability-regimen-roster-and-log.js', import.meta.url), 'utf8');
const crashDeletionSource = await readFile(new URL('../public/assets/js/modules/52-r635-master-backup-delete-and-crash-print-sync.js', import.meta.url), 'utf8');
const sessionDefaultsSource = await readFile(new URL('../public/assets/js/modules/49-asdh-final-persistence-actions-20260725.js', import.meta.url), 'utf8');
const startAppOwnerSource = await readFile(new URL('../public/assets/js/modules/07-expiry-requests-and-primary-features.js', import.meta.url), 'utf8');
// startApp extensions register into window.__startAppExtensions /
// window.__startAppBeforeExtensions instead of each reassigning
// window.startApp with its own "var previousStart=window.startApp;
// window.startApp=function(){...previousStart.apply...}" wrapper. That
// pattern had grown to 7 nested layers across 5 files before being
// consolidated into the single wrapper module 07 owns.
const lifecycleSources = await Promise.all([
  '40-v16-clean-optimized-script.js',
  '49-asdh-final-persistence-actions-20260725.js',
  '59-r664-security-complete-runtime.js',
  '70-r676-accountability-regimen-roster-and-log.js'
].map(name => readFile(new URL(`../public/assets/js/modules/${name}`, import.meta.url), 'utf8')));

test('Crash Cart renderer has one canonical implementation', () => {
  const assignments = crashSource.match(/window\.renderCrashCarts\s*=(?!=)/g) || [];
  assert.equal(assignments.length, 1);
  assert.doesNotMatch(crashSource, /__ccxAliasScope|__ccxCanonicalScope|__ccxSelectorScope|__ccxCartCanonicalScope|__ccxScopedRowsGuard/);
});

test('Crash Cart post-render controls use a hook, not a renderer wrapper', () => {
  assert.match(crashSource, /window\.refreshCrashDeletionControls/);
  assert.match(crashDeletionSource, /window\.refreshCrashDeletionControls\s*=\s*decorate/);
  assert.doesNotMatch(crashDeletionSource, /oldRender\s*=\s*window\.renderCrashCarts/);
  // No MutationObserver-based renderer wrapping (observer for unrelated UI like notes badge is fine)
  assert.doesNotMatch(crashDeletionSource, /new MutationObserver[\s\S]*?renderCrashCarts/);
});

test('session defaults do not wrap the canonical logout lifecycle', () => {
  assert.doesNotMatch(sessionDefaultsSource, /window\.doLogout\s*=\s*async function/);
});

test('startApp has exactly one canonical wrapper, owned by module 07', () => {
  const assignments = startAppOwnerSource.match(/window\.startApp\s*=/g) || [];
  assert.equal(assignments.length, 2); // the core definition, then the single registry-running wrapper
  assert.match(startAppOwnerSource, /window\.__startAppExtensions\.forEach/);
  assert.match(startAppOwnerSource, /window\.__startAppBeforeExtensions\.forEach/);
});

test('startApp extensions register into the shared registry instead of wrapping window.startApp', () => {
  assert.match(authSource, /window\.__startAppExtensions\.push/);
  assert.doesNotMatch(authSource, /var previousStart=window\.startApp/);
});

test('no module outside 07 reassigns window.startApp directly', () => {
  for (const source of lifecycleSources) {
    assert.doesNotMatch(source, /window\.startApp\s*=(?!=)/);
    assert.doesNotMatch(source, /var previousStart=window\.startApp/);
  }
});
