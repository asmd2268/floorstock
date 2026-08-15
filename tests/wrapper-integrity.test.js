import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const crashSource = await readFile(new URL('../public/assets/js/modules/44-ccx-inventory-redesign-script.js', import.meta.url), 'utf8');
const authSource = await readFile(new URL('../public/assets/js/modules/70-r676-accountability-regimen-roster-and-log.js', import.meta.url), 'utf8');
const crashDeletionSource = await readFile(new URL('../public/assets/js/modules/52-r635-master-backup-delete-and-crash-print-sync.js', import.meta.url), 'utf8');
const sessionDefaultsSource = await readFile(new URL('../public/assets/js/modules/49-asdh-final-persistence-actions-20260725.js', import.meta.url), 'utf8');
const lifecycleSources = await Promise.all([
  '40-v16-clean-optimized-script.js',           // was 53-r661-authoritative-inventory-safety.js
  '49-asdh-final-persistence-actions-20260725.js', // was 54-r662-accountability-draft-protection.js
  '59-r664-security-complete-runtime.js',        // was 58-r664-public-privacy-rewrite.js
  '59-r664-security-complete-runtime.js',
  '49-asdh-final-persistence-actions-20260725.js', // was 63-r668-request-lock-drafts-and-session-defaults.js
  '70-r676-accountability-regimen-roster-and-log.js' // was 64-r671-permissions-and-accountability-qr.js
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

test('startApp extensions preserve the previous implementation', () => {
  assert.match(authSource, /var previousStart=window\.startApp/);
  assert.match(authSource, /previousStart\.apply\(this,arguments\)/);
});

test('every startApp wrapper preserves the lifecycle chain', () => {
  for (const source of lifecycleSources) {
    if (!/window\.startApp\s*=/.test(source)) continue;
    assert.match(source, /var previousStart=window\.startApp/);
    assert.match(source, /previousStart\.apply\(this,arguments\)/);
  }
});
