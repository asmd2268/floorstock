'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const core = require('./accountability-partitions-core');

/* accountability_usage_v2 is one document per Hijri month. A usage row is ~688
   bytes, so a single document hit the 1 MiB cap after ~1,500 entries — two to
   three months at twenty a day — which cannot carry the five-year retention the
   custody officer must keep. */

const SEPT_2026 = Date.parse('2026-09-08T10:00:00Z');

test('a row is filed by its Hijri month', () => {
  assert.equal(core.hijriMonthKeyOf('2026-09-08T10:00:00Z'), '1448-03');
  assert.equal(core.usagePartitionId('1448-03', 1), 'accountability_usage_v2_h1448-03');
  assert.equal(core.usagePartitionId('1448-03', 2), 'accountability_usage_v2_h1448-03_p2');
});

test('an unusable date is refused rather than filed under a real month', () => {
  // `new Date(null)` is the epoch, not an invalid date — the trap this guards.
  for (const value of [null, undefined, '', 'not a date', {}, []]) {
    assert.equal(core.hijriMonthKeyOf(value), null, String(value));
  }
});

test("a row's month is derivable from its id alone", () => {
  // Ids carry their creation time, so an operation that names rows by id reads
  // exactly the partitions holding them instead of scanning a window.
  const id = `acc2u_${SEPT_2026}_a1b2c3`;
  assert.equal(core.monthOfUsageId(id), '1448-03');
  assert.equal(core.monthOfUsageRow({ id }), '1448-03');
  // submittedAt wins when present; the id is the fallback.
  assert.equal(core.monthOfUsageRow({ id, submittedAt: '2026-08-10T00:00:00Z' }), '1448-02');
  assert.equal(core.monthOfUsageId('not-an-id'), null);
});

test('the recent-month window walks back across the Hijri year', () => {
  const months = core.recentHijriMonths(4, new Date('2026-08-20T00:00:00Z'));
  assert.equal(months.length, 4);
  assert.equal(months[0], core.hijriMonthKeyOf('2026-08-20T00:00:00Z'));
  // Strictly descending, so a scan sees the newest month first.
  for (let i = 1; i < months.length; i += 1) assert.ok(months[i] < months[i - 1]);
  assert.deepEqual(core.recentHijriMonths(3, new Date('2026-06-20T00:00:00Z')).slice(0, 3).length, 3);
});

test('only the months that actually changed are rewritten', () => {
  const a = { id: 'acc2u_1_x', submittedAt: '2026-08-10T00:00:00Z', units: 1 };
  const b = { id: 'acc2u_2_y', submittedAt: '2026-09-08T00:00:00Z', units: 2 };
  const loadedMonths = ['1448-03', '1448-02'];
  const loadedRows = { '1448-03': [b], '1448-02': [a] };

  // Nothing changed -> nothing written. A month left alone must not be rewritten,
  // both to save writes and so a concurrent editor there is not clobbered.
  assert.deepEqual(core.planUsageWrites(loadedMonths, loadedRows, [b, a]).writes, []);

  // Editing the September row touches only September.
  const edited = Object.assign({}, b, { units: 99 });
  const plan = core.planUsageWrites(loadedMonths, loadedRows, [edited, a]);
  assert.deepEqual(plan.writes.map((w) => w.month), ['1448-03']);
  assert.equal(plan.writes[0].rows[0].units, 99);

  // Removing a row empties its month rather than leaving it stale.
  const removed = core.planUsageWrites(loadedMonths, loadedRows, [b]);
  assert.deepEqual(removed.writes, [{ month: '1448-02', rows: [] }]);
});

test('a row belonging to a month that was not read is reported, never dropped', () => {
  const stray = { id: 'acc2u_3_z', submittedAt: '2025-01-10T00:00:00Z', units: 5 };
  const plan = core.planUsageWrites(['1448-03'], { '1448-03': [] }, [stray]);
  assert.equal(plan.writes.length, 0);
  assert.equal(plan.unplaced.length, 1);
  assert.deepEqual(plan.unplaced[0].rows, [stray]);
});

test('rows with no usable date are not silently filed anywhere', () => {
  const grouped = core.groupRowsByMonth([{ id: 'bad', units: 1 }, null, { id: 'acc2u_x_y' }]);
  assert.deepEqual(Object.keys(grouped), []);
});
