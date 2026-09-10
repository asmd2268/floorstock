/* The weekly ordering window: 7 days × 24 hours of "may this department send a
   request now?", and what the department is told when it may not.

   The grid is stored flat (168 booleans) and read as a 7×24 table, and it is
   read at every request screen — so a hole in it is the difference between a
   ward being able to order and being told, wrongly, that ordering is closed.

   Times are Riyadh times. The hospital's week starts on Saturday, which is why
   the weekly summary lists Saturday first rather than following the array's own
   Sunday-first order.

   An hour is a whole hour: a window that is open at 14:00 stays open until
   15:00, so a request sent at 14:59 is inside it. The closing label for a run
   that reaches the end of the day is written "24:00" rather than "00:00",
   because "open 22:00–00:00" reads as if it closed two hours before it opened.

   Lifted out of modules/42 as one-liners with no test. */

export const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
/* Saturday first: the working week here starts on it. */
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

export function allAllowed() { return Array.from({ length: 7 }, () => Array(24).fill(true)); }
export function allBlocked() { return Array.from({ length: 7 }, () => Array(24).fill(false)); }

/* Anything that is not a full 7×24 table of booleans becomes one. A stored grid
   that is short, ragged or missing reads as CLOSED rather than open: a schedule
   nobody can read must not silently open every hour of the week. */
export function normalizeGrid(grid) {
  const out = allBlocked();
  if (!Array.isArray(grid)) return out;
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) out[day][hour] = !!(grid[day] && grid[day][hour]);
  }
  return out;
}

export function cloneGrid(grid) { return normalizeGrid(grid).map((row) => row.slice()); }

export function flattenGrid(grid) {
  const table = normalizeGrid(grid);
  const out = [];
  for (let day = 0; day < 7; day += 1) for (let hour = 0; hour < 24; hour += 1) out.push(!!table[day][hour]);
  return out;
}

export function unflattenGrid(flat) {
  const out = allBlocked();
  if (!Array.isArray(flat)) return out;
  for (let i = 0; i < 168; i += 1) out[Math.floor(i / 24)][i % 24] = !!flat[i];
  return out;
}

export function hourLabel(hour) { return String(hour).padStart(2, '0') + ':00'; }

export function timeToMinutes(value) {
  const parts = String(value || '00:00').split(':');
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
}

/* Consecutive open hours become one range, so a day open 08:00–12:00 reads as
   one window rather than four. */
export function rowRanges(row) {
  const out = [];
  let start = null;
  for (let hour = 0; hour <= 24; hour += 1) {
    const open = hour < 24 && !!(row && row[hour]);
    if (open && start === null) start = hour;
    if (!open && start !== null) {
      out.push(hourLabel(start) + '–' + (hour === 24 ? '24:00' : hourLabel(hour)));
      start = null;
    }
  }
  return out;
}

/* The next hour this department may order, searched forward across the whole
   week. `minsAway` counts from the current minute, not the current hour. */
export function nextAllowed(grid, at) {
  const table = normalizeGrid(grid);
  for (let step = 1; step <= 168; step += 1) {
    const total = at.hour + step;
    const day = (at.dow + Math.floor(total / 24)) % 7;
    const hour = total % 24;
    if (table[day][hour]) {
      return { dayIndex: day, day: DAYS_EN[day], time: hourLabel(hour), hour, minsAway: step * 60 - at.minute };
    }
  }
  /* A grid with no open hour at all has no next time — reported as none rather
     than as "the same hour next week", which would be a window that never opens. */
  return null;
}

export function currentClose(grid, day, hour) {
  const table = normalizeGrid(grid);
  let end = hour;
  while (end < 24 && table[day][end]) end += 1;
  return end === 24 ? '24:00' : hourLabel(end);
}

export function weeklyAllowedRows(grid) {
  const table = normalizeGrid(grid);
  const rows = [];
  WEEK_ORDER.forEach((day) => {
    const ranges = rowRanges(table[day]);
    if (ranges.length) rows.push({ dayIndex: day, ar: DAYS_AR[day], en: DAYS_EN[day], ranges });
  });
  return rows;
}

export function splitRange(range) {
  const parts = String(range || '').split(/\s*[–-]\s*/);
  return { from: parts[0] || '', to: parts[1] || '' };
}
