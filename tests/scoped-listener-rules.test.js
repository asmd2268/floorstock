import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpeningWave, applySnapshotToCache } from '../public/assets/js/core/scoped-listener-rules.js';

function fakeTimers() {
  const timers = [];
  return {
    timers,
    setTimer: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; },
    clearTimer: (t) => { t.cleared = true; },
  };
}

test('the wave settles once, when every listener has spoken', () => {
  const clock = fakeTimers();
  let settled = 0;
  const wave = createOpeningWave({ count: 3, deadlineMs: 2500, onSettled: () => { settled += 1; }, ...clock });
  wave.arrived(); wave.arrived();
  assert.equal(wave.isSettled(), false);
  wave.arrived();
  assert.equal(wave.isSettled(), true);
  assert.equal(settled, 1);
  assert.equal(clock.timers[0].cleared, true);
  wave.arrived();
  assert.equal(settled, 1);
});

test('the deadline settles the wave when a listener never answers, and only once', () => {
  const clock = fakeTimers();
  let settled = 0;
  const wave = createOpeningWave({ count: 40, deadlineMs: 2500, onSettled: () => { settled += 1; }, ...clock });
  assert.equal(clock.timers[0].ms, 2500);
  wave.arrived();
  clock.timers[0].fn();
  assert.equal(wave.isSettled(), true);
  assert.equal(settled, 1);
  wave.arrived();
  clock.timers[0].fn();
  assert.equal(settled, 1);
});

test('a wave of zero listeners settles on its first arrival or its deadline', () => {
  const clock = fakeTimers();
  let settled = 0;
  createOpeningWave({ count: 0, deadlineMs: 10, onSettled: () => { settled += 1; }, ...clock }).arrived();
  assert.equal(settled, 1);
});

const snap = (exists, value, fromCache = false) => ({ exists, metadata: { fromCache }, data: () => ({ value }) });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

test('a server snapshot updates the cache and reports whether it changed', () => {
  const cache = { a: 1 };
  assert.deepEqual(applySnapshotToCache(cache, 'a', snap(true, 1), same), { changed: false });
  assert.deepEqual(applySnapshotToCache(cache, 'a', snap(true, 2), same), { changed: true });
  assert.equal(cache.a, 2);
  assert.deepEqual(applySnapshotToCache(cache, 'b', snap(true, [1]), same), { changed: true });
  assert.deepEqual(cache.b, [1]);
});

test('an exists:false answer from the local cache never blanks a key we hold', () => {
  const cache = { a: [1, 2] };
  assert.equal(applySnapshotToCache(cache, 'a', snap(false, undefined, true), same), null);
  assert.deepEqual(cache.a, [1, 2]);
});

test('a server-confirmed deletion does blank it, and a cache miss for an unheld key is recorded', () => {
  const cache = { a: [1] };
  assert.deepEqual(applySnapshotToCache(cache, 'a', snap(false, undefined, false), same), { changed: true });
  assert.equal(cache.a, null);
  assert.deepEqual(applySnapshotToCache(cache, 'new', snap(false, undefined, true), same), { changed: true });
  assert.equal(cache.new, null);
});
