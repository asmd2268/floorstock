import test from 'node:test';
import assert from 'node:assert/strict';
import { warmCacheKey, pruneOtherWarmCaches, readWarmCache, saveWarmCache } from '../public/assets/js/core/state-warm-cache.js';

function fakeStorage(init = {}) {
  const data = { ...init };
  return new Proxy({
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  }, { ownKeys: () => Object.keys(data), getOwnPropertyDescriptor: (t, k) => (k in data ? { enumerable: true, configurable: true, value: data[k] } : Reflect.getOwnPropertyDescriptor(t, k)), get: (t, k) => (k in t ? t[k] : data[k]) });
}

test('the key is per account, and empty without a uid', () => {
  assert.equal(warmCacheKey(' u1 '), 'floorstock_last_cache_v2_u1');
  assert.equal(warmCacheKey(''), '');
  assert.equal(warmCacheKey(null), '');
});

test('sign-in removes the shared v1 entry and every other account', () => {
  const s = fakeStorage({ floorstock_last_cache_v1: '{}', floorstock_last_cache_v2_a: '{}', floorstock_last_cache_v2_b: '{}', other: 'x' });
  pruneOtherWarmCaches(s, 'floorstock_last_cache_v2_a');
  assert.equal(s.getItem('floorstock_last_cache_v1'), null);
  assert.equal(s.getItem('floorstock_last_cache_v2_b'), null);
  assert.equal(s.getItem('floorstock_last_cache_v2_a'), '{}');
  assert.equal(s.getItem('other'), 'x');
});

test('a restricted profile restores only what it may read plus the extra keys', () => {
  const s = fakeStorage({ k: JSON.stringify({ meds: [1], secret: [2], crash_reports: [3] }) });
  const out = readWarmCache(s, 'k', { allowedKeys: () => ['meds'], extraKeys: () => ['crash_reports'] });
  assert.deepEqual(out, { meds: [1], crash_reports: [3] });
});

test('no restriction restores everything; nothing stored or no key gives null', () => {
  const s = fakeStorage({ k: JSON.stringify({ a: 1 }) });
  assert.deepEqual(readWarmCache(s, 'k', { allowedKeys: () => null }), { a: 1 });
  assert.equal(readWarmCache(s, 'missing', { allowedKeys: () => null }), null);
  assert.equal(readWarmCache(s, '', { allowedKeys: () => null }), null);
});

test('unavailable storage never throws on read, prune or save', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(readWarmCache(broken, 'k', { allowedKeys: () => null }), null);
  pruneOtherWarmCaches(broken, 'k');
  let warned = 0;
  saveWarmCache(broken, 'k', {}, () => { warned += 1; });
  assert.equal(warned, 1);
});

test('save writes JSON under the key and does nothing without one', () => {
  const s = fakeStorage();
  saveWarmCache(s, 'k', { a: 1 });
  assert.equal(s.getItem('k'), '{"a":1}');
  saveWarmCache(s, '', { a: 1 });
  assert.equal(s.getItem(''), null);
});
