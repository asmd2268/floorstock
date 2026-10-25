import test from 'node:test';
import assert from 'node:assert/strict';
import { selfProfileVerdict } from '../public/assets/js/core/self-profile-guard.js';
import { resolveUserDirectory } from '../public/assets/js/core/users-directory-refresh.js';

const me = { role: 'department', deptId: 'd1', master: false };
const doc = { active: true, role: 'department', deptId: 'd1' };

test('an unchanged profile means nothing', () => {
  assert.equal(selfProfileVerdict(true, doc, me), null);
});

test('a removed document, a deactivation and a permission change each sign out', () => {
  assert.equal(selfProfileVerdict(false, null, me), 'removed');
  assert.equal(selfProfileVerdict(true, { ...doc, active: false }, me), 'deactivated');
  assert.equal(selfProfileVerdict(true, { ...doc, active: undefined }, me), 'deactivated');
  assert.equal(selfProfileVerdict(true, { ...doc, role: 'pharmacy' }, me), 'changed');
  assert.equal(selfProfileVerdict(true, { ...doc, deptId: 'd2' }, me), 'changed');
  assert.equal(selfProfileVerdict(true, { ...doc, master: true }, me), 'changed');
});

test('departmentId is accepted as the department field', () => {
  assert.equal(selfProfileVerdict(true, { active: true, role: 'department', departmentId: 'd1' }, me), null);
});

test('master is compared with the login document, not the effective claim', () => {
  const lagging = { role: 'pharmacy', deptId: '', master: false, documentMaster: true };
  assert.equal(selfProfileVerdict(true, { active: true, role: 'pharmacy', master: true }, lagging), null);
  assert.equal(selfProfileVerdict(true, { active: true, role: 'pharmacy', master: false }, lagging), 'changed');
});

test('the directory prefers the callable', async () => {
  const out = await resolveUserDirectory({ previous: [1], viaCallable: async () => [1, 2], viaFallback: async () => { throw new Error('unused'); } });
  assert.deepEqual(out, [1, 2]);
});

test('a failing callable falls back, with a warning', async () => {
  let warned = 0;
  const out = await resolveUserDirectory({ previous: [], viaCallable: async () => { throw new Error('x'); }, viaFallback: async () => [7], warn: () => { warned += 1; } });
  assert.deepEqual(out, [7]);
  assert.equal(warned, 1);
});

test('an empty answer never blanks a populated directory, but is accepted when nothing was held', async () => {
  assert.deepEqual(await resolveUserDirectory({ previous: [1], viaCallable: async () => [], viaFallback: async () => [] }), [1]);
  assert.deepEqual(await resolveUserDirectory({ previous: [], viaCallable: async () => [], viaFallback: async () => [] }), []);
  assert.deepEqual(await resolveUserDirectory({ previous: undefined, viaCallable: async () => null, viaFallback: async () => [] }), []);
});

test('when the fallback fails too, the error reaches the caller', async () => {
  await assert.rejects(resolveUserDirectory({ previous: [1], viaCallable: async () => { throw new Error('a'); }, viaFallback: async () => { throw new Error('b'); } }), /b/);
});
