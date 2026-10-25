import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStateDocChanges } from '../public/assets/js/core/state-doc-changes.js';

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const change = (type, id, value) => ({ type, doc: { id, data: () => ({ value }) } });
const opts = (skip = () => false) => ({ skip, valuesEqual: eq });

test('added and modified documents land in the cache and report a change', () => {
  const cache = { a: [1] };
  assert.equal(applyStateDocChanges(cache, [change('modified', 'a', [1, 2]), change('added', 'b', 5)], opts()), true);
  assert.deepEqual(cache, { a: [1, 2], b: 5 });
});

test('an identical value reports no change', () => {
  const cache = { a: [1] };
  assert.equal(applyStateDocChanges(cache, [change('modified', 'a', [1])], opts()), false);
});

test('skipped documents never touch the cache, even when removed', () => {
  const cache = { users: ['u'], crash_cart_reports: [1] };
  const skip = (id) => id === 'users' || id === 'crash_cart_reports';
  const changed = applyStateDocChanges(cache, [change('modified', 'users', []), change('removed', 'crash_cart_reports'), change('added', 'crash_cart_reports', [9])], opts(skip));
  assert.equal(changed, false);
  assert.deepEqual(cache, { users: ['u'], crash_cart_reports: [1] });
});

test('removal deletes a held key and ignores one we never had', () => {
  const cache = { a: 1 };
  assert.equal(applyStateDocChanges(cache, [change('removed', 'a')], opts()), true);
  assert.equal('a' in cache, false);
  assert.equal(applyStateDocChanges(cache, [change('removed', 'ghost')], opts()), false);
});

test('one snapshot with several changes reports once, true if any changed', () => {
  const cache = { a: 1, b: 2 };
  assert.equal(applyStateDocChanges(cache, [change('modified', 'a', 1), change('modified', 'b', 3)], opts()), true);
});
