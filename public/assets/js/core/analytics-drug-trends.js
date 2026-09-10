/* Dispensing of ONE medicine over a period: across departments, or inside one.

   Both reports ask the same three questions — how much in total, how it splits,
   and how it moved month by month — so they share everything except a single
   department filter. They were written twice inside modules/73, with the month
   walk (including its year rollover) copied between them.

   Two things are easy to get wrong here and are pinned by tests:

   The range is inclusive of both end months. A user picking March to March
   means March, and picking November to February means four months across the
   new year — not a loop that never terminates.

   A medicine is identified by its normalised name, not the text on the picker.
   The same medicine is typed a dozen ways across departments, so the buckets are
   keyed by identity; looking one up by the display name alone finds nothing and
   reports a confident zero. */

import { computeStats, deptLabel, round1 } from './analytics-engine.js?v=ea7b98eca6';

export const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export function medicineNamesFrom(rows) {
  const stats = computeStats(rows);
  const names = [...Object.values(stats.routine), ...Object.values(stats.high)].map((bucket) => bucket.name).filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/* From the first day of `fromMonth` up to, but not including, the first day of
   the month after `toMonth`. */
export function rowsInRange(rows, fromYear, fromMonth, toYear, toMonth) {
  const fromMs = new Date(fromYear, fromMonth - 1, 1).getTime();
  const toMs = new Date(toYear, toMonth, 1).getTime();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const at = new Date(row.fulfilledAt || row.updatedAt || row.created || 0).getTime();
    return at >= fromMs && at < toMs;
  });
}

export function medicineQty(rows, medicineName) {
  const stats = computeStats(rows);
  const key = typeof globalThis.fsR17MedNorm === 'function'
    ? (globalThis.fsR17MedNorm(medicineName) || medicineName)
    : medicineName;
  const bucket = stats.routine[key] || stats.high[key] || stats.routine[medicineName] || stats.high[medicineName];
  return bucket ? { qty: bucket.qty, depts: bucket.depts } : { qty: 0, depts: {} };
}

/* Every (year, month) in the range, both ends included. */
export function monthsInRange(fromYear, fromMonth, toYear, toMonth) {
  const months = [];
  let year = fromYear, month = fromMonth;
  while (year < toYear || (year === toYear && month <= toMonth)) {
    months.push({ year, month, label: MONTHS_EN[month - 1] || String(month) });
    if (month === 12) { year++; month = 1; } else { month++; }
  }
  return months;
}

function monthlyQuantities(rows, medicineName, fromYear, fromMonth, toYear, toMonth) {
  return monthsInRange(fromYear, fromMonth, toYear, toMonth).map((month) => {
    const monthRows = rowsInRange(rows, month.year, month.month, month.year, month.month);
    return { ...month, qty: medicineQty(monthRows, medicineName).qty };
  });
}

export function drugComparisonStats(rows, medicineName, fromYear, fromMonth, toYear, toMonth) {
  const inRange = rowsInRange(rows, fromYear, fromMonth, toYear, toMonth);
  const total = medicineQty(inRange, medicineName);
  const deptRows = Object.entries(total.depts)
    .map(([dept, qty]) => ({ dept, qty }))
    .sort((a, b) => b.qty - a.qty);

  return {
    medicineName,
    totalQty: total.qty,
    deptRows,
    months: monthlyQuantities(inRange, medicineName, fromYear, fromMonth, toYear, toMonth),
  };
}

export function deptDrugTrendStats(rows, deptId, medicineName, fromYear, fromMonth, toYear, toMonth) {
  const mine = (Array.isArray(rows) ? rows : []).filter((row) => String(row.deptId) === String(deptId));
  const inRange = rowsInRange(mine, fromYear, fromMonth, toYear, toMonth);
  const totalQty = medicineQty(inRange, medicineName).qty;
  const months = monthlyQuantities(inRange, medicineName, fromYear, fromMonth, toYear, toMonth);
  const peak = months.reduce((best, month) => (!best || month.qty > best.qty ? month : best), null);

  return {
    deptName: deptLabel(deptId),
    medicineName,
    totalQty,
    months,
    avgPerMonth: months.length ? round1(totalQty / months.length) : 0,
    /* A peak of zero is not a peak: a medicine nobody dispensed has no busiest
       month, and naming January would read as if it had one. */
    peak: peak && peak.qty > 0 ? peak : null,
    activeMonths: months.filter((month) => month.qty > 0).length,
  };
}
