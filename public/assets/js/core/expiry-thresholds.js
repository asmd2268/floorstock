/* The two numbers that colour every expiry in the pharmacy: how many days count
   as urgent, and how many as near.

   One saved setting, read in four places that each wrote their own copy of the
   defaults — and the defaults have to agree, or the same batch is amber on one
   screen and red on the next.

   `near` is always at least one day past `urgent`: a setting where near ≤ urgent
   would leave the urgent band with nothing in it, so a batch could never be
   reported as merely near. */

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

export function expiryThresholds(saved) {
  const settings = saved && typeof saved === 'object' ? saved : {};
  const urgentDays = Math.max(1, num(settings.urgentDays) || 7);
  const nearDays = Math.max(urgentDays + 1, num(settings.nearDays) || 30);
  return { urgentDays, nearDays };
}

/* Reads the saved setting itself where state is available. */
export function currentExpiryThresholds() {
  let saved = {};
  try {
    saved = (globalThis.S && globalThis.S.g ? globalThis.S.g('pharmacy_department_expiry_rules') : {}) || {};
  } catch (error) {
    console.warn('The expiry thresholds could not be read; the defaults are in use.', error);
  }
  return expiryThresholds(saved);
}
