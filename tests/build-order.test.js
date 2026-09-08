import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// main.js is the single source of truth for import order. module-manifest.json
// used to hold a second copy of that order and had drifted to 28 entries against
// main.js's 50; it was deleted rather than resynced, because two hand-kept lists
// of the same thing drift again. These guards pin the ordering constraints that
// actually matter at runtime.
const main = await readFile(new URL('../public/assets/js/main.js', import.meta.url), 'utf8');
const moduleOrder = [...main.matchAll(/import ['"]\.\/modules\/([^?'"]+)(?:\?[^'"]*)?['"]/g)].map(match => match[1]);
const position = name => moduleOrder.indexOf(name);

test('the Firebase bootstrap and core state module lead the feature modules', () => {
  assert.equal(moduleOrder[0], '01-firebase-global-bootstrap.js');
  assert.equal(moduleOrder[1], '03-core-application-firebase-state-auth.js');
});

test('providers load before the modules that consume their globals', () => {
  // 07 owns the single startApp wrapper every later module registers into.
  const startAppOwner = position('07-expiry-requests-and-primary-features.js');
  assert.ok(startAppOwner > -1);
  ['12-local-daily-backups-system-health.js',
   '40-v16-clean-optimized-script.js',
   '49-asdh-final-persistence-actions-20260725.js',
   '59-r664-security-complete-runtime.js',
   '70-r676-accountability-regimen-roster-and-log.js'].forEach(consumer => {
    assert.ok(position(consumer) > startAppOwner, `${consumer} must load after the startApp owner`);
  });
});

test('no module is imported twice', () => {
  assert.equal(new Set(moduleOrder).size, moduleOrder.length);
});
