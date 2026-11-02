/* The crash-cart list's "expired or within N days" filter.

   The three fixed levels (expired / urgent / near) each cover one band, so a
   bulk replacement could only ever take one band at a time. This filter takes
   everything already past its date plus everything that expires inside a window
   the pharmacist types, so one pass can replace it all.

   Nothing here reads the page except windowDays(); the rest takes "days until"
   as an argument so it can be tested. */
import { parseWindowDays, DEFAULT_WINDOW_DAYS } from './crash-cart-expiry-list.js?v=2190498d29';

export const WINDOW_FILTER = 'window';
export const WINDOW_INPUT_ID = 'ccx-window-days';

/* The window on screen. A value that is not a whole number of days (1..730)
   reads as the default, and the page puts the default back in the box — see
   syncWindowInput — so what is filtered is always what is shown. */
export function windowDays(doc) {
  const el = (doc || document).getElementById(WINDOW_INPUT_ID);
  return parseWindowDays(el ? el.value : DEFAULT_WINDOW_DAYS) || DEFAULT_WINDOW_DAYS;
}

export function syncWindowInput(doc) {
  const d = doc || document;
  const el = d.getElementById(WINDOW_INPUT_ID);
  if (el && String(windowDays(d)) !== String(el.value).trim()) el.value = String(windowDays(d));
}

/* Past its date, or expiring within `days`. A batch with no usable date is not
   in the window: there is nothing to say about when it expires. */
export function batchInWindow(batch, days, daysUntil) {
  if (!batch || !batch.expiry) return false;
  const left = daysUntil(batch.expiry);
  return left !== null && left !== undefined && left <= days;
}

export function itemInWindow(item, days, daysUntil) {
  return ((item && item.batches) || []).some((batch) => batchInWindow(batch, days, daysUntil));
}
