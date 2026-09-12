import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

/* Activate / Deactivate looked dead to the pharmacy: acc2UsesCF() is true for
   every pharmacy role, the callable commits the flip server-side and
   deliberately leaves the local cache alone, and renderMedicationAccountability()
   then redrew the row from the value it still had. The write happened; the
   screen never said so. Usage was mirrored for exactly this reason years ago
   and assignments were not — so the gap was in the pair, not in the wiring. */

const source = fs.readFileSync(new URL('../public/assets/js/modules/50-r617-integrated-operations.js', import.meta.url), 'utf8');

test('assignment mutations that go through the callable mirror their result locally', () => {
  assert.match(source, /function acc2ReflectAssignmentsLocally\(mutate\)/);
  for (const action of ['toggleAssignment', 'deleteAssignment', 'resetBalance']) {
    const call = source.indexOf(`action:'${action}'`);
    assert.ok(call > -1, `${action} is no longer sent`);
    const after = source.slice(call, call + 320);
    assert.match(after, /acc2ReflectAssignmentsLocally/, `${action} commits server-side and leaves the row stale on screen`);
  }
});

test('the mirror writes the assignments key, not the usage key', () => {
  const body = source.slice(source.indexOf('function acc2ReflectAssignmentsLocally'));
  assert.match(body.slice(0, 400), /S\.cache\[ACC2_ASSIGNMENTS_KEY\]/);
});

test('the listener stays the source of truth', () => {
  /* A mirror that threw would be worse than no mirror: the callable already
     succeeded, so the failure must not surface as a failed action. */
  const body = source.slice(source.indexOf('function acc2ReflectAssignmentsLocally'));
  assert.match(body.slice(0, 600), /try\{/);
  assert.match(body.slice(0, 600), /listener will correct it/);
});
