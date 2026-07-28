import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const usersSource = fs.readFileSync(
  new URL('../public/assets/js/modules/07-expiry-requests-and-primary-features.js', import.meta.url),
  'utf8',
);
const masterTestSource = fs.readFileSync(
  new URL('../public/assets/js/modules/51-asdhealth-canonical-r6-32-20260727.js', import.meta.url),
  'utf8',
);
const inventorySafetySource = fs.readFileSync(
  new URL('../public/assets/js/modules/53-r661-authoritative-inventory-safety.js', import.meta.url),
  'utf8',
);

test('Users page actions use CSP-safe delegated event bindings', () => {
  assert.doesNotMatch(usersSource, /onclick=["'][^"']*delUser/);
  assert.doesNotMatch(usersSource, /onclick=["'][^"']*toggleMasterUser/);
  assert.match(usersSource, /data-user-action="delete"/);
  assert.match(usersSource, /data-user-action="toggle-master"/);
  assert.match(usersSource, /userTable\.addEventListener\('click'/);
});

test('Master Test Mode modal actions do not rely on blocked inline handlers', () => {
  assert.doesNotMatch(masterTestSource, /onclick=["'][^"']*masterApplyRole/);
  assert.doesNotMatch(masterTestSource, /onclick=["'][^"']*masterResetRole/);
  assert.match(masterTestSource, /data-master-test-action="apply"/);
  assert.match(masterTestSource, /data-master-test-action="exit"/);
  assert.match(masterTestSource, /modal\.addEventListener\('click'/);
});

test('Inventory snapshots are removed and denied outside the actual Master session', () => {
  assert.match(inventorySafetySource, /if\(window\.MASTER_EFFECTIVE\)return false/);
  assert.match(inventorySafetySource, /function removeSnapshotManager\(\)/);
  assert.match(inventorySafetySource, /if\(!masterAllowed\(\)\)\{removeSnapshotManager\(\);return\}/);
  assert.match(inventorySafetySource, /window\.undoLatestInventorySafetySnapshot=async function\(\)\{\s*if\(!masterAllowed\(\)\)/);
});
