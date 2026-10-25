import test from 'node:test';
import assert from 'node:assert/strict';
import { carryOverFailedKeys, carryOverDepartmentKeys, applyStateCache } from '../public/assets/js/core/state-poll-reconcile.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

test('a key whose read failed keeps its previous value; a key read as null does not', () => {
  const incoming = { a: 1, gone: null };
  carryOverFailedKeys(incoming, { a: 0, b: 'old', gone: 'was here', c: 'x' }, ['b', 'gone', 'missing']);
  assert.deepEqual(incoming, { a: 1, gone: null, b: 'old' });
});

test('failed keys that the poll did return, or that never existed, are left alone', () => {
  const incoming = { a: 2 };
  assert.equal(carryOverFailedKeys(incoming, { a: 1 }, ['a', 'zzz']), incoming);
  assert.deepEqual(incoming, { a: 2 });
  assert.deepEqual(carryOverFailedKeys({ a: 1 }, {}, undefined), { a: 1 });
});

test('without departments in the poll, the known departments keys are carried over', () => {
  const previous = { departments: [{ id: 'icu' }], meds_icu: [1], expiry_icu: [2], other: 3 };
  const incoming = { theme: 'dark' };
  carryOverDepartmentKeys(incoming, previous, () => ['meds_icu', 'expiry_icu', 'shelves_icu']);
  assert.deepEqual(incoming, { theme: 'dark', meds_icu: [1], expiry_icu: [2] });
});

test('nothing is carried when the poll returned departments, or none were known', () => {
  const returned = { departments: [], x: 1 };
  carryOverDepartmentKeys(returned, { departments: [{ id: 'a' }], meds_a: [1] }, () => ['meds_a']);
  assert.deepEqual(returned, { departments: [], x: 1 });
  const unknown = { x: 1 };
  carryOverDepartmentKeys(unknown, { departments: [], meds_a: [1] }, () => ['meds_a']);
  carryOverDepartmentKeys(unknown, {}, () => ['meds_a']);
  assert.deepEqual(unknown, { x: 1 });
});

test('applying a poll deletes missing keys, except users, and reports changes', () => {
  const current = { a: 1, b: 2, users: ['u'] };
  assert.equal(applyStateCache(current, { a: 1, b: 2 }, same), false);
  assert.deepEqual(current, { a: 1, b: 2, users: ['u'] });
  assert.equal(applyStateCache(current, { a: 1 }, same), true);
  assert.deepEqual(current, { a: 1, users: ['u'] });
  assert.equal(applyStateCache(current, { a: 5, c: { n: 1 } }, same), true);
  assert.deepEqual(current, { a: 5, c: { n: 1 }, users: ['u'] });
});

test('an equal but newly built value is still stored, without reporting a change', () => {
  const first = { list: [1, 2] };
  const current = { k: first.list };
  const next = { k: [1, 2] };
  assert.equal(applyStateCache(current, next, same), false);
  assert.equal(current.k, next.k);
});
