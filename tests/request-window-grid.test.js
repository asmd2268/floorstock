import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizeGrid, cloneGrid, flattenGrid, unflattenGrid, allAllowed, allBlocked,
  rowRanges, nextAllowed, currentClose, weeklyAllowedRows, hourLabel, timeToMinutes, splitRange,
} from '../public/assets/js/core/request-window-grid.js';

/* The weekly ordering window. This decides whether a ward can send its request
   at all, and what it is told when it cannot — read at every request screen and
   never tested. */

const openAt = (...hours) => {
  const grid = allBlocked();
  hours.forEach(([day, hour]) => { grid[day][hour] = true; });
  return grid;
};

test('a grid nobody can read is closed, not open', () => {
  /* A short, ragged or missing schedule must not silently open the whole week. */
  assert.deepEqual(normalizeGrid(null), allBlocked());
  assert.deepEqual(normalizeGrid('nonsense'), allBlocked());
  assert.deepEqual(normalizeGrid([[true]])[0][0], true);
  assert.equal(normalizeGrid([[true]])[0][23], false, 'the missing hours are closed');
  assert.equal(normalizeGrid([[true]]).length, 7, 'and the missing days exist and are closed');
  assert.equal(normalizeGrid([[true]])[6].every((hour) => hour === false), true);
});

test('a grid survives being stored flat and read back', () => {
  const grid = openAt([0, 8], [3, 14], [6, 23]);
  assert.deepEqual(unflattenGrid(flattenGrid(grid)), grid);
  assert.equal(flattenGrid(grid).length, 168);
  assert.deepEqual(unflattenGrid(null), allBlocked());
});

test('a copy of a grid is not the same grid', () => {
  const grid = allAllowed();
  const copy = cloneGrid(grid);
  copy[0][0] = false;
  assert.equal(grid[0][0], true, 'editing a draft must not edit the saved schedule');
});

test('consecutive hours read as one window, and a day open to midnight says 24:00', () => {
  const row = Array(24).fill(false);
  [8, 9, 10, 11].forEach((hour) => { row[hour] = true; });
  assert.deepEqual(rowRanges(row), ['08:00–12:00'], 'four open hours are one window, not four');

  const evening = Array(24).fill(false);
  [22, 23].forEach((hour) => { evening[hour] = true; });
  assert.deepEqual(rowRanges(evening), ['22:00–24:00'], '"22:00–00:00" would read as closing before it opened');

  const split = Array(24).fill(false);
  [8, 9, 14, 15].forEach((hour) => { split[hour] = true; });
  assert.deepEqual(rowRanges(split), ['08:00–10:00', '14:00–16:00']);
  assert.deepEqual(rowRanges([]), []);
});

test('an open hour runs to the end of that hour', () => {
  /* A window open at 14:00 is still open at 14:59. */
  const grid = openAt([2, 14]);
  assert.equal(currentClose(grid, 2, 14), '15:00');
  const long = openAt([2, 14], [2, 15], [2, 16]);
  assert.equal(currentClose(long, 2, 14), '17:00');
  const toMidnight = openAt([2, 23]);
  assert.equal(currentClose(toMidnight, 2, 23), '24:00');
});

test('the next opening is found across the rest of the week', () => {
  const grid = openAt([3, 9]);                       // Wednesday 09:00
  const next = nextAllowed(grid, { dow: 1, hour: 10, minute: 30 });  // Monday 10:30
  assert.equal(next.day, 'Wednesday');
  assert.equal(next.time, '09:00');
  assert.equal(next.minsAway, 47 * 60 - 30, 'counted from the current minute, not the top of the hour');
});

test('the next opening wraps into the following week', () => {
  const grid = openAt([1, 8]);                       // Monday 08:00
  const next = nextAllowed(grid, { dow: 1, hour: 9, minute: 0 });    // just missed it
  assert.equal(next.day, 'Monday');
  assert.equal(next.dayIndex, 1);
  assert.equal(next.minsAway, 167 * 60, 'a week minus an hour away');
});

test('a schedule with no open hour has no next opening at all', () => {
  /* Reported as none rather than "the same hour next week", which would be a
     window that never actually opens. */
  assert.equal(nextAllowed(allBlocked(), { dow: 0, hour: 0, minute: 0 }), null);
  assert.equal(nextAllowed(allAllowed(), { dow: 0, hour: 0, minute: 0 }).minsAway, 60);
});

test('the weekly summary starts on Saturday, the way the week does here', () => {
  const grid = openAt([6, 8], [0, 9], [3, 10]);
  const rows = weeklyAllowedRows(grid);
  assert.deepEqual(rows.map((row) => row.en), ['Saturday', 'Sunday', 'Wednesday']);
  assert.equal(rows[0].ar, 'السبت');
  assert.deepEqual(rows[0].ranges, ['08:00–09:00']);
  assert.deepEqual(weeklyAllowedRows(allBlocked()), [], 'a week with nothing open lists nothing');
});

test('hours and ranges are written and read back the same way', () => {
  assert.equal(hourLabel(0), '00:00');
  assert.equal(hourLabel(9), '09:00');
  assert.equal(timeToMinutes('14:30'), 870);
  assert.equal(timeToMinutes(''), 0);
  assert.equal(timeToMinutes('nonsense'), 0);
  assert.deepEqual(splitRange('08:00–12:00'), { from: '08:00', to: '12:00' });
  assert.deepEqual(splitRange('08:00-12:00'), { from: '08:00', to: '12:00' }, 'a plain hyphen reads too');
  assert.deepEqual(splitRange(''), { from: '', to: '' });
});
