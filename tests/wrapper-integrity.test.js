import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const crashSource = await readFile(new URL('../public/assets/js/modules/44-ccx-inventory-redesign-script.js', import.meta.url), 'utf8');
const authSource = await readFile(new URL('../public/assets/js/modules/64-r671-permissions-and-accountability-qr.js', import.meta.url), 'utf8');
const lifecycleSources = await Promise.all([
  '53-r661-authoritative-inventory-safety.js',
  '54-r662-accountability-draft-protection.js',
  '58-r664-public-privacy-rewrite.js',
  '59-r664-security-complete-runtime.js',
  '63-r668-request-lock-drafts-and-session-defaults.js',
  '64-r671-permissions-and-accountability-qr.js'
].map(name => readFile(new URL(`../public/assets/js/modules/${name}`, import.meta.url), 'utf8')));

test('Crash Cart renderer wrappers are explicitly idempotent', () => {
  const assignments = crashSource.match(/window\.renderCrashCarts\s*=/g) || [];
  assert.ok(assignments.length >= 1);
  for (const flag of ['__ccxAliasScope', '__ccxCanonicalScope', '__ccxSelectorScope', '__ccxCartCanonicalScope', '__ccxScopedRowsGuard']) {
    assert.match(crashSource, new RegExp(flag));
  }
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
