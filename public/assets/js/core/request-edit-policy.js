const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

function normalizedGrid(grid) {
  return Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => Boolean(grid && grid[day] && grid[day][hour])),
  );
}

function riyadhParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const values = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).forEach((part) => {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  });
  const dayOfWeek = new Date(Date.UTC(values.year, values.month - 1, values.day)).getUTCDay();
  return { ...values, dayOfWeek };
}

export function requestWindowDeadlineFromGrid(grid, submittedAt) {
  const parts = riyadhParts(submittedAt);
  if (!parts) return 0;
  const schedule = normalizedGrid(grid);
  if (!schedule[parts.dayOfWeek][parts.hour]) return 0;

  const localHourEpoch = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, 0, 0, 0);
  for (let step = 1; step <= 168; step += 1) {
    const totalHour = parts.hour + step;
    const day = (parts.dayOfWeek + Math.floor(totalHour / 24)) % 7;
    const hour = totalHour % 24;
    if (!schedule[day][hour]) return localHourEpoch + step * 60 * 60 * 1000 - RIYADH_OFFSET_MS;
  }
  return null;
}

export function canEditRequestBeforeDeadline(request, nowValue, deadline) {
  if (!request || request.status !== 'pending') return false;
  if (request.fulfilledAt || request.fulfilled === true || typeof request.fulfilled === 'string') return false;
  if (deadline === null) return true;
  const now = new Date(nowValue).getTime();
  return Number.isFinite(now) && Number.isFinite(deadline) && deadline > 0 && now < deadline;
}
