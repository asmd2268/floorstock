/* What a controlled medicine's row says: expiring, out, below minimum, or fine.

   The order of the checks is the rule. Expiry outranks quantity, and "out of
   stock" outranks "below minimum", because that is the order a pharmacist has
   to act in: expired stock must be pulled whatever the count says, and a shelf
   with nothing on it is a different problem from a shelf with too little.

   Both sides are checked — the warehouse and the pharmacy — and the WORST of
   the two decides. A medicine in date in the warehouse but expiring in the
   pharmacy is expiring; a medicine well stocked in the warehouse but empty in
   the pharmacy is out of stock, because that is where it is dispensed from.

   `daysUntil` compares calendar days, not instants: something expiring today is
   at zero days and reads as expired, whatever hour the page was opened.

   Lifted out of modules/07j with no behaviour change. */

function num(value) { const n = Number(String(value == null ? '' : value).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; }

export function daysUntil(value, today = new Date()) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const parts = raw.split('-');
  const date = parts.length === 3
    ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((date.getTime() - midnight.getTime()) / 86400000);
}

/* The nearest expiry among a set of batches. Batches with no readable date do
   not count as "expiring soon" — an unrecorded date is unknown, not urgent. */
export function earliestDays(batches, today = new Date()) {
  const found = (batches || [])
    .map((batch) => daysUntil(batch && batch.expiry, today))
    .filter((days) => days !== null);
  return found.length ? Math.min(...found) : null;
}

export const STATUS = { expired: 'expired', soon: 'soon', out: 'out', low: 'low', ok: 'ok' };

export function controlledStatusKey(medicine, warehouse, pharmacy, alertDays = 60, today = new Date()) {
  const min = num(medicine && medicine.min);
  const warehouseQty = num(warehouse && warehouse.system) + num(warehouse && warehouse.outside);
  const pharmacyQty = num(pharmacy && pharmacy.qty);
  const both = [earliestDays(warehouse && warehouse.batches, today), earliestDays(pharmacy && pharmacy.batches, today)]
    .filter((days) => days !== null);
  const earliest = both.length ? Math.min(...both) : null;

  if (earliest !== null && earliest <= 0) return STATUS.expired;
  if (earliest !== null && earliest <= alertDays) return STATUS.soon;
  if (warehouseQty === 0 || pharmacyQty === 0) return STATUS.out;
  if (min > 0 && (warehouseQty < min || pharmacyQty < min)) return STATUS.low;
  return STATUS.ok;
}

export function controlledStatus(medicine, warehouse, pharmacy, alertDays = 60, today = new Date()) {
  const key = controlledStatusKey(medicine, warehouse, pharmacy, alertDays, today);
  const html = {
    expired: '<span class="badge brd">Expired</span>',
    soon: '<span class="badge byl">Expiring ≤ ' + alertDays + 'd</span>',
    out: '<span class="badge brd">Out of stock</span>',
    low: '<span class="badge byl">Below minimum</span>',
    ok: '<span class="badge bgn">OK</span>',
  }[key];
  return { key, html };
}
