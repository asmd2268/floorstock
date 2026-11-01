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
     different things to replace.
   - A medicine a cart holds less of than its standard (a recorded present count
     below a standard above 0) is a shortage whatever the window: the cart is short
     by standard minus present. A cart that holds none is short by the whole
     standard, and produces no expiry rows, since whatever batches are still
     recorded on it are stale. A present count never recorded is not a shortage. */

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

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function describe(cart, item) {
  return {
    cartId: String(cart.id),
    cartName: clean(cart.name || cart.number || cart.id),
    generic: genericNameOf(item),
    strength: clean(item.strength || item.concentration),
  };
}

/* Out of stock: a recorded present count of zero against a standard above zero.
   A count that was never recorded is not evidence the cart is empty. */
function recordedPresent(item) {
  return item.present != null && item.present !== '';
}

export function isUnavailable(item) {
  return recordedPresent(item) && number(item.present) === 0 && number(item.qty) > 0;
}

/* How many units the cart is short of its standard; 0 when it is not short. */
export function shortageOf(item) {
  if (!recordedPresent(item) || number(item.qty) <= 0) return 0;
  return Math.max(0, number(item.qty) - number(item.present));
}

export function unavailableRows(carts) {
  const rows = [];
  (Array.isArray(carts) ? carts : []).forEach((cart) => {
    (Array.isArray(cart && cart.items) ? cart.items : []).forEach((item) => {
      const shortage = shortageOf(item);
      if (shortage > 0) rows.push({ ...describe(cart, item), standard: number(item.qty), present: number(item.present), shortage });
    });
  });
  return rows.sort((a, b) => collator.compare(a.cartName, b.cartName) || collator.compare(a.generic, b.generic));
}

export function expiringRows(carts, windowDays, daysUntil) {
  const rows = [];
  (Array.isArray(carts) ? carts : []).forEach((cart) => {
    (Array.isArray(cart && cart.items) ? cart.items : []).forEach((item) => {
      if (isUnavailable(item)) return;
      quantitiesByExpiry(item).forEach((qty, expiry) => {
        const days = daysUntil(expiry);
        if (days === null || days === undefined || days > windowDays) return;
        if (qty === 0) return;
        rows.push({
          ...describe(cart, item),
          expiry,
          qty,
          expired: days < 0,
        });
      });
    });
  });
  return rows.sort((a, b) => collator.compare(a.cartName, b.cartName)
    || a.expiry.localeCompare(b.expiry)
    || collator.compare(a.generic, b.generic));
}

/* One mark per medicine a cart can be out of, in the order they are first met. */
export const MARKS = ['★', '#', '†', '‡', '§', '¶', '◆', '●', '▲', '■'];

export function summarize(rows, missing = []) {
  const medicines = new Map();
  let total = 0;
  let uncounted = 0;
  const entryFor = (row) => {
    const key = keyPart(row.generic) + '|' + keyPart(row.strength);
    if (!medicines.has(key)) medicines.set(key, { generic: row.generic, strength: row.strength, carts: new Set(), qty: 0, uncounted: 0, out: new Map() });
    return medicines.get(key);
  };
  rows.forEach((row) => {
    const entry = entryFor(row);
    entry.carts.add(row.cartId);
    if (row.qty === null) { entry.uncounted += 1; uncounted += 1; } else { entry.qty += row.qty; total += row.qty; }
  });
  missing.forEach((row) => entryFor(row).out.set(row.cartId, { cartName: row.cartName, standard: row.standard, shortage: row.shortage }));
  const list = [...medicines.values()]
    .map((entry) => ({
      generic: entry.generic, strength: entry.strength, carts: entry.carts.size, qty: entry.qty, uncounted: entry.uncounted,
      missingCarts: entry.out.size, addQty: [...entry.out.values()].reduce((sum, c) => sum + c.shortage, 0), outIn: [...entry.out.values()].sort((a, b) => collator.compare(a.cartName, b.cartName)), mark: '',
    }))
    .sort((a, b) => b.qty - a.qty || b.missingCarts - a.missingCarts || a.generic.localeCompare(b.generic));
  let next = 0;
  list.forEach((entry) => { if (entry.missingCarts) { entry.mark = MARKS[next % MARKS.length]; next += 1; } });
  const cartIds = new Set([...rows, ...missing].map((row) => row.cartId));
  const totalAdd = list.reduce((sum, entry) => sum + entry.addQty, 0);
  return { medicines: list, totalQty: total, totalAdd, totalRows: rows.length, uncountedRows: uncounted, missingRows: missing.length, cartCount: cartIds.size };
}

/* One block per cart that has something expiring, because the new seal is one
   number for the whole cart. What a cart is out of takes no rows of its own — it
   is a mark on the cart's name, explained in the summary. */
export function groupByCart(rows, summary, missing) {
  const markOf = new Map(summary.medicines.map((m) => [keyPart(m.generic) + '|' + keyPart(m.strength), m.mark]));
  const outByCart = new Map();
  missing.forEach((row) => {
    const mark = markOf.get(keyPart(row.generic) + '|' + keyPart(row.strength));
    outByCart.set(row.cartId, (outByCart.get(row.cartId) || []).concat(mark));
  });
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.cartId)) groups.set(row.cartId, { cartId: row.cartId, cartName: row.cartName, marks: (outByCart.get(row.cartId) || []).sort(), lines: [] });
    groups.get(row.cartId).lines.push(row);
  });
  return [...groups.values()].sort((a, b) => collator.compare(a.cartName, b.cartName));
}

/* The whole thing, for the caller that has a user's carts and a clock. */
export function crashCartExpiryList(carts, windowDays, daysUntil) {
  const rows = expiringRows(carts, windowDays, daysUntil);
  const missing = unavailableRows(carts);
  const summary = summarize(rows, missing);
  return { windowDays, rows, missing, groups: groupByCart(rows, summary, missing), summary };
}
