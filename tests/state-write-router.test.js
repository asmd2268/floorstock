import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateWriter } from '../public/assets/js/core/state-write-router.js';

function setup(over = {}) {
  const log = [];
  const tracked = [];
  const write = createStateWriter({
    partitionsAreLive: over.partitionsAreLive || (() => false),
    applyPartitionedArray: over.applyPartitionedArray || (async (k, v) => { log.push(['month', k, v]); }),
    hasOverflowParts: over.hasOverflowParts || (() => false),
    estimateDocBytes: over.estimateDocBytes || (() => 10),
    overflowSplitBytes: 100,
    writeWithOverflow: over.writeWithOverflow || (async (k, v, put) => { log.push(['split', k]); await put(k + '_p2', { part: 2 }); }),
    putChunkInCache: (id, chunk) => log.push(['cache', id, chunk]),
    setDocument: async (id, chunk) => { log.push(['set', id, chunk]); },
    isRowMergedKey: over.isRowMergedKey || (() => false),
    saveRowsMerging: over.saveRowsMerging || (async (k, v, opts) => { log.push(['merge', k, v, typeof opts.fallback]); }),
    plainSet: (k, v) => { log.push(['plain', k, v]); return Promise.resolve('plain'); },
    trackSave: (promise, label) => { tracked.push(label); return promise; },
    notifyFailure: (message) => log.push(['toast', message]),
  });
  return { write, log, tracked };
}

const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };

test('month-partitioned keys write only by month, and are tracked', async () => {
  const { write, log, tracked } = setup({ partitionsAreLive: (k) => k === 'orders' });
  await write('orders', [1]);
  assert.deepEqual(log, [['month', 'orders', [1]]]);
  assert.deepEqual(tracked, ['floorstock_state/orders (by month)']);
});

test('a value too big for one document is split, and each chunk goes to the cache then the store', async () => {
  const { write, log, tracked } = setup({ estimateDocBytes: () => 500 });
  await write('big', { a: 1 });
  assert.deepEqual(log, [['split', 'big'], ['cache', 'big_p2', { part: 2 }], ['set', 'big_p2', { part: 2 }]]);
  assert.deepEqual(tracked, ['floorstock_state/big (split)']);
});

test('a key that already has parts is split again even when it now fits, but only objects are split', async () => {
  const split = setup({ hasOverflowParts: () => true });
  await split.write('k', { a: 1 });
  assert.equal(split.log[0][0], 'split');
  const primitive = setup({ hasOverflowParts: () => true });
  await primitive.write('k', 'text');
  assert.deepEqual(primitive.log, [['plain', 'k', 'text']]);
  const nothing = setup({ estimateDocBytes: () => 500 });
  await nothing.write('k', null);
  assert.deepEqual(nothing.log, [['plain', 'k', null]]);
});

test('row-merged lists are written as a diff with a plain fallback; other arrays are plain', async () => {
  const merged = setup({ isRowMergedKey: (k) => k === 'requests' });
  await merged.write('requests', [{ id: 1 }]);
  assert.deepEqual(merged.log, [['merge', 'requests', [{ id: 1 }], 'function']]);
  assert.deepEqual(merged.tracked, ['floorstock_state/requests (merged)']);
  await merged.write('other', [1]);
  assert.deepEqual(merged.log.at(-1), ['plain', 'other', [1]]);
  assert.equal(merged.tracked.length, 1);
});

test('the plain path is returned untouched and is not tracked here', async () => {
  const { write, tracked } = setup();
  assert.equal(await write('theme', { dark: true }), 'plain');
  assert.deepEqual(tracked, []);
});

test('a failed write tells the person once and rethrows to the caller', async () => {
  const boom = new Error('quota');
  const { write, log } = setup({ partitionsAreLive: () => true, applyPartitionedArray: async () => { throw boom; } });
  await quiet(async () => { await assert.rejects(write('orders', []), (error) => error === boom); });
  assert.deepEqual(log, [['toast', 'Save failed — quota']]);
});
