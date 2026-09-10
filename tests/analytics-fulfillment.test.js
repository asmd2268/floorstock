import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  requestFulfillmentPct, fulfillmentStats, median,
} from '../public/assets/js/core/analytics-engine.js';

/* Second slice out of modules/73: how much of what a department asked for
   actually arrived, and how long it took. The arithmetic decides what the
   annual report tells a director, and it had no test — it lived inside a
   1,300-line IIFE reading its inputs from globals. */

const name = (id) => `Dept ${id}`;
const request = (over = {}) => ({
  status: 'fulfilled',
  deptId: 'a',
  created: '2026-03-01T08:00:00Z',
  fulfilledAt: '2026-03-01T12:00:00Z',
  items: [{ qty: 10 }],
  dispensed: [{ qty: 10 }],
  ...over,
});

test('a request nobody asked anything for has no percentage — it is not a zero', () => {
  assert.equal(requestFulfillmentPct({ items: [], dispensed: [] }), null);
  assert.equal(requestFulfillmentPct({}), null);
  // Counting it as 0% would drag every average down by the number of empty rows.
  const stats = fulfillmentStats([request({ items: [] }), request()], 2026, name);
  assert.equal(stats.total, 1);
  assert.equal(stats.avgPct, 100);
});

test('percentages are the share dispensed, rounded to one place', () => {
  assert.equal(requestFulfillmentPct({ items: [{ qty: 3 }], dispensed: [{ qty: 1 }] }), 33.3);
  assert.equal(requestFulfillmentPct({ items: [{ qty: 10 }], dispensed: [{ qty: 10 }] }), 100);
  assert.equal(requestFulfillmentPct({ items: [{ qty: 10 }], dispensed: [] }), 0, 'asked for and got nothing IS a zero');
  assert.equal(requestFulfillmentPct({ items: [{ qty: 2 }, { qty: 2 }], dispensed: [{ qty: 2 }] }), 50);
});

test('only fulfilled and partial requests of that year are counted', () => {
  const rows = [
    request({ status: 'pending' }),
    request({ status: 'rejected' }),
    request({ status: 'partial', dispensed: [{ qty: 5 }] }),
    request({ fulfilledAt: '2025-03-01T12:00:00Z' }),
    request(),
  ];
  const stats = fulfillmentStats(rows, 2026, name);
  assert.equal(stats.total, 2);
  assert.equal(stats.avgPct, 75, 'the partial at 50% and the full at 100%');
});

test('departments are ranked worst first, because that is who needs looking at', () => {
  const rows = [
    request({ deptId: 'good' }),
    request({ deptId: 'bad', dispensed: [{ qty: 2 }] }),
    request({ deptId: 'bad', dispensed: [{ qty: 4 }] }),
  ];
  const stats = fulfillmentStats(rows, 2026, name);
  assert.deepEqual(stats.deptStats.map((d) => d.dept), ['Dept bad', 'Dept good']);
  assert.equal(stats.deptStats[0].avg, 30);
  assert.equal(stats.deptStats[0].count, 2);
});

test('an archived month is not timed — it would add a 0-hour row every month', () => {
  /* An archive row is one synthetic request whose created and fulfilledAt are
     both the month start. Timing it drags the median turnaround toward zero. */
  const rows = [
    request({ created: '2026-03-01T00:00:00Z', fulfilledAt: '2026-03-01T00:00:00Z', __aggregated: true }),
    request({ created: '2026-03-01T00:00:00Z', fulfilledAt: '2026-03-01T10:00:00Z' }),
  ];
  const stats = fulfillmentStats(rows, 2026, name);
  assert.equal(stats.total, 2, 'the archived month still counts toward fulfilment');
  assert.equal(stats.timedCount, 1, 'but not toward turnaround');
  assert.equal(stats.medianHours, 10);
});

test('a request finished before it was created is not timed at all', () => {
  const stats = fulfillmentStats([request({ created: '2026-03-02T00:00:00Z', fulfilledAt: '2026-03-01T00:00:00Z' })], 2026, name);
  assert.equal(stats.timedCount, 0);
  assert.equal(stats.medianHours, null);
});

test('on-time is measured only against requests that had a slot', () => {
  const rows = [
    request({ scheduledFor: '2026-03-01T18:00:00Z' }),                                   // done 12:00 — on time
    request({ scheduledFor: '2026-03-01T09:00:00Z' }),                                   // done 12:00 — late
    request(),                                                                            // no slot
  ];
  const stats = fulfillmentStats(rows, 2026, name);
  assert.equal(stats.scheduled, 2);
  assert.equal(stats.onTime, 1);
  assert.equal(stats.onTimePct, 50);
});

test('with no scheduled requests the rate is unknown, not zero', () => {
  const stats = fulfillmentStats([request()], 2026, name);
  assert.equal(stats.onTimePct, null);
});

test('the ten worst requests are listed worst first', () => {
  const rows = Array.from({ length: 12 }, (unused, i) => request({ dispensed: [{ qty: i }] }));
  const stats = fulfillmentStats(rows, 2026, name);
  assert.equal(stats.worst10.length, 10);
  assert.deepEqual(stats.worst10.map((x) => x.pct).slice(0, 3), [0, 10, 20]);
});

test('an empty year reports nothing rather than dividing by zero', () => {
  const stats = fulfillmentStats([], 2026, name);
  assert.deepEqual(
    { total: stats.total, avgPct: stats.avgPct, medianHours: stats.medianHours, onTimePct: stats.onTimePct },
    { total: 0, avgPct: null, medianHours: null, onTimePct: null },
  );
  assert.deepEqual(fulfillmentStats(null, 2026, name).deptStats, []);
});

test('one median, used everywhere in the engine', () => {
  assert.equal(median([]), null);
  assert.equal(median([5]), 5);
  assert.equal(median([1, 3]), 2);
  assert.equal(median([1, 2, 100]), 2, 'a median ignores the outlier a mean would chase');
});
