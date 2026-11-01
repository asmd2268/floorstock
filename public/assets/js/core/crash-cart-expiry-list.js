/* Which crash-cart medicines need their stock replaced soon.

   A pharmacist working through the carts wants one list: for each cart, each
   medicine with a batch expiring inside the window, how many units, and when.
   Nothing here reads the page or the user — the carts it is handed are already
   the ones that user may see, and "today" arrives as `daysUntil`, so the rules
   below can be tested.

   Rules worth knowing:
   - A batch already past its date is on the list too (days < 0): it needs
     replacing more than any other.
   - Batches of one medicine in one cart that expire on the same day are one row.
   - A batch whose quantity was never recorded takes whatever the cart's present
     count leaves over, but only when it is the only such batch. With two or more
     unknown batches nothing honest can be said per batch, so the row carries no
     quantity and the totals report how many rows are uncounted.
   - Medicines are grouped by generic name AND strength: 5 mg and 10 mg are
     different things to replace. */

export const DEFAULT_WINDOW_DAYS = 60;
export const MAX_WINDOW_DAYS = 730;

/* A window typed by a person: whole days, 1..MAX. Anything else is rejected
   rather than quietly replaced by a default the person did not ask for. */
export function parseWindowDays(value) {
  const text = String(value == null ? '' : value).trim();
  if (!/^\d+$/.test(text)) return null;
  const days = Number(text);
  return days >= 1 && days <= MAX_WINDOW_DAYS ? days : null;
}

const clean = (value) => String(value == null ? '' : value).trim();
const keyPart = (value) => clean(value).toLowerCase().replace(/\s+/g, ' ');
const number = (value) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };

export function genericNameOf(item) {
  return clean(item && (item.genericName || item.generic || item.name)) || 'Medication';
}

/* Quantity per distinct expiry date for one item, with null meaning "not
   recorded and cannot be inferred". */
function quantitiesByExpiry(item) {
  const byDate = new Map();
  let unknownDates = 0;
  let known = 0;
  (Array.isArray(item.batches) ? item.batches : []).forEach((batch) => {
    const expiry = clean(batch && batch.expiry).slice(0, 10);
    if (!expiry) return;
    const entry = byDate.get(expiry) || { qty: 0, unknown: false };
    if (batch.qty == null || batch.qty === '') {
      if (!entry.unknown) unknownDates += 1;
      entry.unknown = true;
    } else {
      entry.qty += number(batch.qty);
      known += number(batch.qty);
    }
    byDate.set(expiry, entry);
  });
  const present = number(item.present != null ? item.present : item.qty);
  const out = new Map();
  byDate.forEach((entry, expiry) => {
    if (!entry.unknown) { out.set(expiry, entry.qty); return; }
    out.set(expiry, unknownDates === 1 ? entry.qty + Math.max(0, present - known) : null);
  });
  return out;
}

export function expiringRows(carts, windowDays, daysUntil) {
  const rows = [];
  (Array.isArray(carts) ? carts : []).forEach((cart) => {
    (Array.isArray(cart && cart.items) ? cart.items : []).forEach((item) => {
      quantitiesByExpiry(item).forEach((qty, expiry) => {
        const days = daysUntil(expiry);
        if (days === null || days === undefined || days > windowDays) return;
        if (qty === 0) return;
        rows.push({
          cartId: String(cart.id),
          cartName: clean(cart.name || cart.number || cart.id),
          generic: genericNameOf(item),
          strength: clean(item.strength || item.concentration),
          expiry,
          qty,
          expired: days < 0,
        });
      });
    });
  });
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  return rows.sort((a, b) => collator.compare(a.cartName, b.cartName)
    || a.expiry.localeCompare(b.expiry)
    || collator.compare(a.generic, b.generic));
}

export function summarize(rows) {
  const medicines = new Map();
  let total = 0;
  let uncounted = 0;
  rows.forEach((row) => {
    const key = keyPart(row.generic) + '|' + keyPart(row.strength);
    const entry = medicines.get(key) || { generic: row.generic, strength: row.strength, carts: new Set(), qty: 0, uncounted: 0 };
    entry.carts.add(row.cartId);
    if (row.qty === null) { entry.uncounted += 1; uncounted += 1; } else { entry.qty += row.qty; total += row.qty; }
    medicines.set(key, entry);
  });
  const list = [...medicines.values()]
    .map((entry) => ({ generic: entry.generic, strength: entry.strength, carts: entry.carts.size, qty: entry.qty, uncounted: entry.uncounted }))
    .sort((a, b) => b.qty - a.qty || a.generic.localeCompare(b.generic));
  return { medicines: list, totalQty: total, totalRows: rows.length, uncountedRows: uncounted, cartCount: new Set(rows.map((row) => row.cartId)).size };
}

/* The whole thing, for the caller that has a user's carts and a clock. */
export function crashCartExpiryList(carts, windowDays, daysUntil) {
  const rows = expiringRows(carts, windowDays, daysUntil);
  return { windowDays, rows, summary: summarize(rows) };
}
