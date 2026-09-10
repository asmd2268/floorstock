/* Taking a dispensed quantity out of a set of controlled batches, and adding it
   to the receiving department's.

   First expiry, first out. A controlled cupboard is counted batch by batch, and
   the batch closest to expiring is the one that has to leave first — anything
   else quietly ages stock into the bin while newer stock is dispensed.

   A batch with no expiry recorded sorts LAST, not first: it is not known to be
   old, and dispensing it ahead of a dated batch would push a real expiry closer
   to the edge on the strength of a missing field.

   The shortfall is reported, never absorbed. If the batches do not add up to the
   quantity asked for, the caller is told how much was missing so it can refuse —
   dispensing more than the batches account for would leave a cupboard whose
   total no longer matches the sum of what is in it.

   Nothing here writes: it returns what would remain, what was taken, and what
   was short. Lifted out of modules/40, where it was two very long lines with no
   test. */

const NO_EXPIRY_SORTS_LAST = '9999';

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

export function consumeBatches(batches, qty) {
  let left = num(qty);
  const remaining = [];
  const used = [];

  (Array.isArray(batches) ? batches : []).slice()
    .sort((a, b) => String((a && a.expiry) || NO_EXPIRY_SORTS_LAST)
      .localeCompare(String((b && b.expiry) || NO_EXPIRY_SORTS_LAST)))
    .forEach((batch) => {
      let held = num(batch && batch.qty);
      const take = Math.min(held, left);
      if (take > 0) used.push({ qty: take, expiry: (batch && batch.expiry) || '', lot: (batch && batch.lot) || '' });
      left -= take;
      held -= take;
      if (held > 0) remaining.push(Object.assign({}, batch, { qty: held }));
    });

  return { remaining, used, short: left };
}

/* Batches are one row per (expiry, lot): the same lot arriving twice is one
   batch holding more, not two rows a counter has to add up by hand. A row that
   ends at zero is dropped — it records nothing the movement log does not. */
export function mergeBatches(existing, incoming) {
  const byKey = {};
  const order = [];
  (existing || []).concat(incoming || []).forEach((batch) => {
    if (!batch) return;
    const key = (batch.expiry || '') + '|' + (batch.lot || '');
    if (!byKey[key]) { byKey[key] = { qty: 0, expiry: batch.expiry || '', lot: batch.lot || '' }; order.push(key); }
    byKey[key].qty += num(batch.qty);
  });
  return order.map((key) => byKey[key]).filter((batch) => batch.qty > 0);
}
