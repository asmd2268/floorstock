import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { buildTestSession, restoreActualSession, isTestingAnotherRole } from '../public/assets/js/core/master-test-mode.js';

/* The first slice out of modules/51 (2,234 lines). These invariants were spread
   through a DOM handler where nothing could reach them; each had already gone
   wrong at least once. */

const MASTER = { id: 'u-master', uid: 'auth-master', email: 'master@hospital', username: 'Ali', master: true };

test('the tested session is still the Master, acting as someone else', () => {
  const { user } = buildTestSession({
    actual: MASTER,
    profile: { id: 'u-staff', role: 'pharmacy_staff', username: 'Sara', email: 'sara@hospital' },
    meta: { mode: 'user' },
  });
  // The identity does not move: the audit trail has to say who really acted.
  assert.equal(user.id, 'u-master');
  assert.equal(user.uid, 'auth-master');
  assert.equal(user.actualUserId, 'u-master');
  assert.equal(user.actualEmail, 'master@hospital');
  assert.equal(user.testedUserId, 'u-staff');
  // Only the role is borrowed.
  assert.equal(user.role, 'pharmacy_staff');
});

test('a tested session never keeps master rights', () => {
  /* Test mode exists to see what another role sees, which is worthless if the
     session quietly keeps its own rights. */
  const { user } = buildTestSession({ actual: MASTER, profile: { id: 'x', role: 'department', deptId: 'icu', master: true }, meta: {} });
  assert.equal(user.master, false);
});

test('a department role without a department is refused', () => {
  for (const role of ['department', 'outpatient_pharmacy_supervisor']) {
    assert.throws(() => buildTestSession({ actual: MASTER, profile: { id: 'x', role } }), /department is required/, role);
  }
  // And is accepted with one, carrying the resolved name.
  const { user, testMode } = buildTestSession({
    actual: MASTER, profile: { id: 'x', role: 'department', deptId: 'icu' }, deptName: 'Intensive Care',
  });
  assert.equal(user.deptId, 'icu');
  assert.equal(user.deptName, 'Intensive Care');
  assert.equal(testMode.deptName, 'Intensive Care');
});

test('a role with no department carries none, rather than an empty one', () => {
  const { user, testMode } = buildTestSession({ actual: MASTER, profile: { id: 'x', role: 'pharmacy_staff' }, deptName: 'Leftover' });
  assert.equal(user.deptId, null);
  assert.equal(user.deptName, '');
  assert.equal(testMode.deptId, null);
});

test('the note describes the test; it is not a user', () => {
  /* Six call sites once read identity off this object and saw a user with no id
     and no username. It carries exactly five descriptive fields. */
  const { testMode } = buildTestSession({
    actual: MASTER, profile: { id: 'u-staff', role: 'pharmacy_staff', email: 'sara@hospital' }, meta: { mode: 'user' },
  });
  assert.deepEqual(Object.keys(testMode).sort(), ['deptId', 'deptName', 'email', 'mode', 'role', 'testedUserId']);
  assert.equal(testMode.master, undefined);
  assert.equal(testMode.id, undefined);
});

test('a role stand-in gets a stable tested id', () => {
  const { testMode } = buildTestSession({ actual: MASTER, profile: { role: 'warehouse' }, meta: { mode: 'role' } });
  assert.equal(testMode.testedUserId, 'role:warehouse');
  assert.equal(testMode.mode, 'role');
});

test('missing pieces are refused rather than guessed', () => {
  assert.throws(() => buildTestSession({ actual: null, profile: { role: 'pharmacy' } }), /Actual Master profile is unavailable/);
  assert.throws(() => buildTestSession({ actual: MASTER, profile: {} }), /Choose a role to test/);
  assert.throws(() => restoreActualSession(null), /Master profile is unavailable/);
});

test('leaving test mode returns the Master exactly as they signed in', () => {
  const restored = restoreActualSession(MASTER);
  assert.deepEqual(restored, MASTER);
  assert.notEqual(restored, MASTER, 'a copy, so the stored profile cannot be mutated later');
  assert.equal(isTestingAnotherRole(null), false);
  assert.equal(isTestingAnotherRole({ role: 'department' }), true);
});

test('the module that owned this now delegates to it', async () => {
  const module51 = await readFile(new URL('../public/assets/js/modules/51-asdhealth-canonical-r6-32-20260727.js', import.meta.url), 'utf8');
  assert.match(module51, /buildTestSession\(/);
  assert.match(module51, /restoreActualSession\(/);
  // The rules must live in one place, not be restated in the handler.
  assert.ok(!/master:false,/.test(module51.replace(/\/\*[\s\S]*?\*\//g, '')), 'the session shape belongs to core/master-test-mode.js');
});
