import assert from 'node:assert/strict';
import { test } from 'node:test';

import { splitForPurge, validPurgeDays, MIN_PURGE_DAYS } from '../public/assets/js/core/pharmacy-inventory-retention.js';

/* How long a stock movement is kept. The purge used to ignore the retention
   stamp written onto each record and re-derive a cut-off from whatever the
   setting says today — so shortening the period reached back and destroyed
   records that had been recorded under a promise to keep them longer. */

const NOW = Date.UTC(2026, 2, 1);
const daysAgo = (days) => new Date(NOW - days * 864e5).toISOString();
const txn = (over = {}) => ({ id: 't', createdAt: daysAgo(400), purgeAfter: daysAgo(35), ...over });

test('a movement inside the window is kept', () => {
  const { keep, purge } = splitForPurge([txn({ createdAt: daysAgo(100) })], { now: NOW, purgeDays: 365 });
  assert.equal(purge.length, 0);
  assert.equal(keep.length, 1);
});

test('a movement past both its own stamp and the window may go', () => {
  const { purge } = splitForPurge([txn()], { now: NOW, purgeDays: 365 });
  assert.equal(purge.length, 1);
});

test('shortening the retention period does not reach back and delete', () => {
  /* Recorded when the setting was three years; the Master then sets 90 days.
     The record was kept under a promise and the promise holds. */
  const recorded = txn({ createdAt: daysAgo(400), purgeAfter: new Date(NOW + 700 * 864e5).toISOString() });
  const { keep, purge } = splitForPurge([recorded], { now: NOW, purgeDays: 90 });
  assert.equal(purge.length, 0);
  assert.equal(keep.length, 1);
});

test('lengthening the retention period protects records stamped for less', () => {
  const recorded = txn({ createdAt: daysAgo(400), purgeAfter: daysAgo(35) });
  const { purge } = splitForPurge([recorded], { now: NOW, purgeDays: 1000 });
  assert.equal(purge.length, 0, 'the longer of the two promises governs');
});

test('a record from before stamps existed falls back to the current window', () => {
  const old = { id: 'legacy', createdAt: daysAgo(400) };
  assert.equal(splitForPurge([old], { now: NOW, purgeDays: 365 }).purge.length, 1);
  assert.equal(splitForPurge([old], { now: NOW, purgeDays: 500 }).purge.length, 0);
});

test('a record with no readable date is kept — unknown age is not a reason to destroy it', () => {
  const rows = [{ id: 'a' }, { id: 'b', createdAt: '' }, { id: 'c', createdAt: 'nonsense' }];
  const { keep, purge } = splitForPurge(rows, { now: NOW, purgeDays: 30 });
  assert.equal(purge.length, 0);
  assert.equal(keep.length, 3);
});

test('the window can never be shorter than the floor, whatever is passed in', () => {
  /* A retention of a few days makes the history unusable for the stock-take it
     exists to support. */
  const recent = txn({ createdAt: daysAgo(20), purgeAfter: daysAgo(1) });
  assert.equal(splitForPurge([recent], { now: NOW, purgeDays: 1 }).purge.length, 0);
  assert.equal(splitForPurge([recent], { now: NOW, purgeDays: 0 }).purge.length, 0);
  assert.equal(MIN_PURGE_DAYS, 30);
});

test('the setting refuses anything under the floor rather than silently correcting it', () => {
  assert.equal(validPurgeDays('365'), 365);
  assert.equal(validPurgeDays(30), 30);
  assert.equal(validPurgeDays(29), null);
  assert.equal(validPurgeDays('abc'), null);
  assert.equal(validPurgeDays(''), null);
});

test('nothing in, nothing out', () => {
  assert.deepEqual(splitForPurge(null, { now: NOW }), { keep: [], purge: [] });
});
