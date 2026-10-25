import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntervalRunner } from '../public/assets/js/core/interval-runner.js';

function clock() {
  const live = new Map(); let id = 0;
  return {
    live,
    setTimer: (fn, ms) => { id += 1; live.set(id, { fn, ms }); return id; },
    clearTimer: (h) => { live.delete(h); },
  };
}

test('start schedules the job at the given period', () => {
  const c = clock(); let runs = 0;
  const r = createIntervalRunner(() => { runs += 1; }, 30000, c);
  r.start();
  assert.equal(r.isRunning(), true);
  const [t] = [...c.live.values()];
  assert.equal(t.ms, 30000);
  t.fn(); t.fn();
  assert.equal(runs, 2);
});

test('starting twice never leaves two timers', () => {
  const c = clock();
  const r = createIntervalRunner(() => {}, 1, c);
  r.start(); r.start(); r.start();
  assert.equal(c.live.size, 1);
});

test('stop clears the timer, and is safe when not running', () => {
  const c = clock();
  const r = createIntervalRunner(() => {}, 1, c);
  r.stop();
  r.start(); r.stop();
  assert.equal(c.live.size, 0);
  assert.equal(r.isRunning(), false);
  r.start();
  assert.equal(r.isRunning(), true);
});

test('the job receives no arguments from the timer', () => {
  const c = clock(); let seen = 'unset';
  const r = createIntervalRunner(function () { seen = arguments.length; }, 1, c);
  r.start();
  [...c.live.values()][0].fn('tick');
  assert.equal(seen, 0);
});
