/* Moving quantity in and out of a crash cart item's dated batches.

   A crash cart is counted twice: the item's own `present` count, and the sum of
   its batches. These functions are what keep the two telling the same story
   while a department reports consumption and the pharmacy answers it.

   Deducting takes from the earliest expiry first, and when the report named an
   expiry it takes from that one alone — a nurse who wrote down the box she used
   is not overruled by a rule about which box should have gone first.

   A quantity that the batches cannot account for is NOT silently dropped. It is
   returned as `untrackedDeductedQty`, so the report records that this much left
   the cart without a batch to attribute it to, and putting it back later does
   not invent a batch that never existed.

   Adding a replacement merges into the batch already holding that expiry with no
   lot number recorded — the pharmacy's own top-ups accumulate in one row instead
   of one row per report — while a batch with a lot number stays separate,
   because a lot is a fact about a specific delivery.

   Lifted out of modules/80 with the clock and the actor passed in. */

const EPSILON = 1e-6;

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

export function dateKey(value) { return String(value || '').slice(0, 10); }

export function itemPresent(item) {
  if (item && item.stockStatus === 'out_of_stock' && item.present == null) return 0;
  return num(item && item.present != null ? item.present : item && item.qty);
}

export function itemStandard(item) { return num(item && item.qty); }

/* Take `qty` out, from `reportedExpiry` when one was named, earliest-first
   otherwise. Mutates the item, which is a copy the caller made. */
export function deductReported(item, qty, reportedExpiry, { now = () => new Date().toISOString(), actor = () => '' } = {}) {
  let left = num(qty);
  const taken = [];
  const batches = Array.isArray(item.batches) ? item.batches.map((batch) => Object.assign({}, batch)) : [];

  batches
    .map((batch, index) => ({ batch, index }))
    .filter((entry) => num(entry.batch.qty) > 0
      && (!reportedExpiry || dateKey(entry.batch.expiry) === dateKey(reportedExpiry)))
    .sort((a, b) => dateKey(a.batch.expiry).localeCompare(dateKey(b.batch.expiry)) || a.index - b.index)
    .forEach((entry) => {
      if (left <= 0) return;
      const take = Math.min(left, num(entry.batch.qty));
      if (!(take > 0)) return;
      entry.batch.qty = num(entry.batch.qty) - take;
      left -= take;
      taken.push({
        batchId: entry.batch.batchId || entry.batch.id || '',
        expiry: dateKey(entry.batch.expiry),
        lot: entry.batch.lot || entry.batch.batch || '',
        qty: take,
      });
    });

  if (reportedExpiry && left > EPSILON) {
    throw new Error('The selected expiry does not contain enough quantity. / التاريخ المحدد لا يحتوي على كمية كافية.');
  }

  item.batches = batches.filter((batch) => num(batch.qty) > 0);
  const untracked = Math.max(0, left);
  const present = itemPresent(item);
  if (num(qty) > present + EPSILON) throw new Error('Reported quantity exceeds the current cart quantity.');

  item.present = Math.max(0, present - num(qty));
  item.stockStatus = item.present <= 0 ? 'out_of_stock' : item.present < itemStandard(item) ? 'partial' : 'available';
  item.updatedAt = now();
  item.updatedBy = actor();
  return { deductionBatches: taken, untrackedDeductedQty: untracked, deductedQty: num(qty), deductedAtReport: true };
}

export function addDatedQuantity(item, date, qty, reportId, {
  now = () => new Date().toISOString(), actor = () => '',
  newId = () => 'ccb_' + Math.random().toString(36).slice(2, 9),
} = {}) {
  const amount = num(qty);
  if (!(amount > 0)) return;
  const batches = Array.isArray(item.batches) ? item.batches.map((batch) => Object.assign({}, batch)) : [];
  const target = batches.find((batch) => dateKey(batch.expiry) === dateKey(date) && !String(batch.lot || '').trim());
  if (target) {
    target.qty = num(target.qty) + amount;
    target.sourceReportId = reportId;
    target.updatedAt = now();
  } else {
    batches.push({
      id: newId(), qty: amount, expiry: dateKey(date), lot: '',
      source: 'pharmacy_report_replacement', sourceReportId: reportId,
      updatedAt: now(), updatedBy: actor(),
    });
  }
  /* Kept in expiry order so the next deduction takes the earliest without
     having to sort a list somebody has been appending to for a year. */
  item.batches = batches.sort((a, b) => dateKey(a.expiry).localeCompare(dateKey(b.expiry)));
}

/* Remove from ONE named expiry — the correction path, where the pharmacist is
   moving a quantity off a batch they have identified. Refuses rather than
   spilling into another batch. */
export function removeFromExpiry(item, date, qty) {
  let left = num(qty);
  const next = [];
  ((item && item.batches) || []).forEach((batch) => {
    const copy = Object.assign({}, batch);
    if (left > 0 && dateKey(copy.expiry) === dateKey(date)) {
      const take = Math.min(left, num(copy.qty));
      copy.qty = num(copy.qty) - take;
      left -= take;
    }
    if (num(copy.qty) > 0) next.push(copy);
  });
  if (left > EPSILON) {
    throw new Error('The selected old expiry does not contain enough quantity. / التاريخ القديم المحدد لا يحتوي على كمية كافية.');
  }
  item.batches = next;
}
