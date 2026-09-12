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

/* The one rule every custody write has to satisfy: the batch lines add up to the
   quantity the row says is held. A register whose lines and total disagree is a
   discrepancy to resolve at the cupboard, not a display detail to round away.

   A quantity is inferred in exactly one case — a single dated batch, which can
   only be holding all of it. Everything else that does not add up is REFUSED and
   returned as a message, because the alternative the bulk department editor used
   to take (write the blank as 0) records "this lot is empty" about a lot that is
   not empty.

   كميات الدفعات يجب أن تساوي الكمية الفعلية، وإلا يُرفض الحفظ. */
export function reconcileBatchQuantities(actual, batches) {
  const total = num(actual);
  if (total < 0) return { error: 'Actual quantity cannot be negative / الكمية الفعلية لا يمكن أن تكون سالبة' };
  const rows = (Array.isArray(batches) ? batches : []).map((batch) => Object.assign({}, batch));
  if (total === 0) return { batches: [] };
  if (!rows.length) return { error: 'At least one expiry date is required when quantity is positive. Batch/Lot is optional / تاريخ الانتهاء مطلوب للكمية الموجبة، ورقم التشغيلة اختياري' };
  if (rows.length === 1 && rows[0].expiry && !(num(rows[0].qty) > 0)) rows[0].qty = total;
  for (const row of rows) {
    if (!(num(row.qty) > 0)) return { error: 'Every expiry row requires a quantity greater than zero / كل تاريخ يحتاج كمية أكبر من صفر' };
    if (!row.expiry) return { error: 'Expiry date is required for every entered quantity; Batch/Lot remains optional / التاريخ مطلوب لكل كمية ورقم التشغيلة اختياري' };
  }
  const sum = rows.reduce((carried, row) => carried + num(row.qty), 0);
  if (sum !== total) return { error: 'Expiry quantities must equal the actual quantity. Total: ' + sum + ' / Actual: ' + total };
  return { batches: rows };
}

/* What each batch actually RECORDS, for anyone republishing or printing it.

   A quantity nobody entered comes back as '' — unknown — never as 0. The two
   claims are not the same: 0 says the lot is empty, and a department reading
   "0 → 31/08/2028" under a medicine it is holding three of has been told
   something false about a narcotic.

   Rows written before per-batch counting carry the whole amount on the row with
   every batch left at zero; when the lines add to nothing and the row still
   holds stock, every line is unknown rather than empty.

   الكمية غير المسجلة تبقى غير معروفة، ولا تُنشر صفراً. */
export function recordedBatchQuantities(batches, actualTotal) {
  const rows = Array.isArray(batches) ? batches : [];
  const known = rows.map((batch) => {
    const raw = batch && batch.qty;
    return raw === '' || raw == null || !Number.isFinite(Number(raw)) ? null : num(raw);
  });
  const sum = known.reduce((carried, value) => carried + (value || 0), 0);
  const total = actualTotal === '' || actualTotal == null ? null : num(actualTotal);
  if (sum === 0 && total !== null && total > 0) return rows.map(() => '');
  return known.map((value) => (value === null ? '' : value));
}
