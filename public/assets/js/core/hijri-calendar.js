/* Hijri (Umm al-Qura) calendar helpers — one implementation.

   These lived inside module 76's IIFE, where only the Hijri ledger view could
   reach them. The controlled and accountability ledgers are now stored one
   document per HIJRI month, and the export picker offers Hijri months, so the
   conversion is shared infrastructure rather than one screen's private helper.

   Umm al-Qura is the civil calendar in Saudi Arabia and is what the pharmacy's
   own registers are kept in, so a month boundary here matches the boundary the
   custody officer actually reports against. */

export const HIJRI_MONTHS_AR = Object.freeze([
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
]);

export const HIJRI_MONTHS_EN = Object.freeze([
  'Muharram', 'Safar', 'Rabi I', 'Rabi II', 'Jumada I', 'Jumada II',
  'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhu al-Qidah', 'Dhu al-Hijjah',
]);

export function hijriParts(value) {
  /* `new Date(null)` is the epoch, not an invalid date, so a row with a null date
     would be filed under a real Hijri month instead of being refused. Only a
     string, a number, or a Date is a date here. */
  if (value == null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(date);
    const out = {};
    parts.forEach((part) => {
      if (part.type === 'year') out.year = Number(part.value);
      if (part.type === 'month') out.month = Number(part.value);
      if (part.type === 'day') out.day = Number(part.value);
    });
    return (out.year && out.month && out.day) ? out : null;
  } catch (error) {
    return null;
  }
}

/* '1447-03'. Zero-padded so string comparison orders months correctly, which is
   what the partition listing and every range filter rely on. */
export function hijriMonthKey(value) {
  const parts = hijriParts(value);
  return parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : null;
}

export function hijriMonthLabel(year, month) {
  return `${HIJRI_MONTHS_AR[month - 1] || month} ${year} هـ`;
}

export function hijriMonthLabelBilingual(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) return String(monthKey || '');
  return `${HIJRI_MONTHS_EN[month - 1] || month} ${year} — ${HIJRI_MONTHS_AR[month - 1] || month} ${year} هـ`;
}

export function hijriDateLabel(value) {
  const parts = hijriParts(value);
  if (!parts) return '—';
  return `${parts.day} ${HIJRI_MONTHS_AR[parts.month - 1] || parts.month} ${parts.year}`;
}

export function currentHijri() {
  return hijriParts(new Date()) || { year: 1447, month: 1, day: 1 };
}

export function currentHijriMonthKey() {
  const now = currentHijri();
  return `${now.year}-${String(now.month).padStart(2, '0')}`;
}

/* Steps a Hijri month key by whole months. The Hijri year is always 12 months,
   so this is exact arithmetic and needs no calendar lookup — only the day count
   inside a month varies, which nothing here depends on. */
export function shiftHijriMonth(monthKey, delta) {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return null;
  const total = (year * 12 + (month - 1)) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12 + 12) % 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

export function hijriMonthsBetween(fromMonthKey, toMonthKey) {
  const months = [];
  let cursor = fromMonthKey;
  // 240 months is twenty Hijri years — far past any retention window, and a
  // guard against a reversed or malformed range spinning forever.
  for (let guard = 0; guard < 240 && cursor && cursor <= toMonthKey; guard += 1) {
    months.push(cursor);
    cursor = shiftHijriMonth(cursor, 1);
  }
  return months;
}

Object.assign(globalThis, {
  HIJRI_MONTHS_AR,
  HIJRI_MONTHS_EN,
  hijriParts,
  hijriMonthKey,
  hijriMonthLabel,
  hijriMonthLabelBilingual,
  hijriDateLabel,
  currentHijri,
  currentHijriMonthKey,
  shiftHijriMonth,
  hijriMonthsBetween,
});
