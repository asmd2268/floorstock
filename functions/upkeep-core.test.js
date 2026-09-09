'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const core = require('./upkeep-core');

/* This file decides what gets deleted, on a schedule, with nobody watching. It
   is pure so every rule can be proved without a database. */

const NOW = new Date('2026-09-09T12:00:00.000Z');
const daysAgo = (days) => new Date(NOW.getTime() - days * 86400000).toISOString();

test('rotation keeps the newest and never guesses at an undated row', () => {
  const policy = { key: 'k', dateFields: ['date'], maxAgeDays: 400 };
  const rows = [
    { id: 'old', date: daysAgo(500) },
    { id: 'recent', date: daysAgo(10) },
    { id: 'undated' },
  ];
  const result = core.rotateRows(rows, policy, NOW);
  assert.deepEqual(result.kept.map((row) => row.id), ['recent', 'undated']);
  assert.equal(result.dropped, 1);
  // Idempotent: a second pass changes nothing.
  assert.equal(core.rotateRows(result.kept, policy, NOW).dropped, 0);
});

test('only instrumentation rotates', () => {
  /* The whole safety argument. A record, a statistic or anything a regulator may
     ask for must never be on this list. */
  assert.deepEqual(core.ROTATIONS.map((policy) => policy.key).sort(),
    ['department_request_notifications_v1', 'user_activity_daily_v1']);
});

test('a whole expired month can go, and an unrecognised id never can', () => {
  const policy = { maxAgeDays: 400 };
  assert.equal(core.partitionMonthIsExpired('user_activity_daily_v1_g2024-01', 'user_activity_daily_v1', policy, NOW), true);
  assert.equal(core.partitionMonthIsExpired('user_activity_daily_v1_g2026-08', 'user_activity_daily_v1', policy, NOW), false);
  assert.equal(core.partitionMonthIsExpired('user_activity_daily_v1_g2024-01_p2', 'user_activity_daily_v1', policy, NOW), true);
  // Not a partition of this key: null means "do not touch", never "delete".
  assert.equal(core.partitionMonthIsExpired('requests_g2024-01', 'user_activity_daily_v1', policy, NOW), null);
  assert.equal(core.partitionMonthIsExpired('user_activity_daily_v1', 'user_activity_daily_v1', policy, NOW), null);
  assert.equal(core.partitionMonthIsExpired('anything_else', 'user_activity_daily_v1', policy, NOW), null);
});

test('an undo stack is trimmed by bytes, newest first', () => {
  const entry = (id, size) => ({ id, at: `2026-0${id}-01`, departments: { icu: 'x'.repeat(size) } });
  const rows = [entry(1, 200000), entry(2, 200000), entry(3, 200000)];
  const result = core.trimToBudget(rows, 300 * 1024);
  assert.equal(result.kept[0].id, 1, 'undo uses the newest, so the newest must survive');
  assert.ok(result.dropped >= 1);
  // An entry too large alone keeps its identity, without the payload.
  const huge = core.trimToBudget([entry(1, 400000)], 300 * 1024);
  assert.equal(huge.kept[0].undoUnavailable, true);
  assert.equal(huge.kept[0].departments, undefined);
  assert.equal(huge.kept[0].id, 1);
});

test('only closed reports past the window are archived', () => {
  const rows = [
    { id: 'a', status: 'closed', closedAt: daysAgo(300), openedAt: daysAgo(300) },
    { id: 'b', status: 'closed', closedAt: daysAgo(10) },
    { id: 'c', status: 'open', openedAt: daysAgo(900) },
    { id: 'd', status: 'pending', openedAt: daysAgo(900) },
    { id: 'e', status: 'closed' },
  ];
  assert.deepEqual(core.reportsToArchive(rows, NOW).map((row) => row.id), ['a']);
  assert.deepEqual(core.groupByGregorianMonth(core.reportsToArchive(rows, NOW), ['openedAt']),
    { [core.gregorianMonthKey(daysAgo(300))]: [rows[0]] });
});

test('dedupe removes a repeat, never a first occurrence', () => {
  const plan = core.planDedupe({
    'k_g2026-01': [{ id: 'a' }, { id: 'b' }],
    'k_g2026-02': [{ id: 'b' }, { id: 'c' }],
  });
  assert.equal(plan.removed, 1);
  assert.deepEqual(plan.writes['k_g2026-02'].map((row) => row.id), ['c']);
  assert.equal(plan.writes['k_g2026-01'], undefined, 'an untouched document is not rewritten');
  // Idempotent.
  assert.equal(core.planDedupe({ 'k_g2026-01': [{ id: 'a' }] }).removed, 0);
});

test('content matching applies only to ids this project invented', () => {
  const same = { dept: 'icu', qty: 2 };
  const plan = core.planDedupe({
    d1: [{ id: 'req_migrated_aa', ...same }, { id: 'req_migrated_bb', ...same }],
  });
  assert.equal(plan.removed, 1, 'the same row imported twice under two invented ids');
  // Two real rows that merely look alike keep both identities.
  const real = core.planDedupe({ d1: [{ id: 'req_1', ...same }, { id: 'req_2', ...same }] });
  assert.equal(real.removed, 0);
});
