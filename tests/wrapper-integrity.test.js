import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const crashSource = await readFile(new URL('../public/assets/js/modules/44-ccx-inventory-redesign-script.js', import.meta.url), 'utf8');
const authSource = await readFile(new URL('../public/assets/js/modules/64-r671-permissions-and-accountability-qr.js', import.meta.url), 'utf8');

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
