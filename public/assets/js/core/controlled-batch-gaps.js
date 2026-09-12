/* Which custody rows still cannot say how much sits under each expiry date.

   The bulk cross-department editor used to push {expiry, qty:0} without the sum
   check every other custody writer enforces, so wards carry rows whose medicine
   total is right and whose per-lot split is missing. The register now refuses to
   save that shape, but the rows already written stay wrong until a pharmacist
   opens each medicine and enters the split — and nothing told anyone WHICH
   medicines those are. Finding them by opening every department is how they stay
   unfixed.

   The judgement of "does this row add up" is not restated here. It is
   reconcileBatchQuantities, the same rule the editors save through, so a row this
   report calls settled is exactly a row that rule accepts — including its one
   inference, that a single dated lot holds all of it.

   يبيّن أي الأدوية ما زالت بلا توزيع كميات على التواريخ. */

import { reconcileBatchQuantities } from './controlled-batch-consumption.js?v=80230e0fce';

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/* Why a row cannot be printed as a custody sheet yet. Separate reasons, because
   they are separate jobs at the cupboard: one needs counting, one needs a date,
   one needs a recount because the numbers disagree. */
export function batchGapReason(row) {
  const actual = num(row && (row.actualQty != null ? row.actualQty : row.qty));
  const batches = Array.isArray(row && row.batches) ? row.batches : [];
  if (actual <= 0) return null;                       // nothing held, nothing to split
  if (!batches.length) return 'no-expiry';
  const settled = reconcileBatchQuantities(actual, batches);
  if (!settled.error) return null;
  const counted = batches.reduce((carried, batch) => carried + num(batch && batch.qty), 0);
  if (counted === 0) return 'uncounted';              // dates recorded, quantities never were
  return 'mismatch';                                  // they were counted, and they disagree
}

const LABEL = {
  'no-expiry': 'No expiry date recorded / لا يوجد تاريخ انتهاء',
  uncounted: 'Quantities never entered / الكميات غير مُدخلة',
  mismatch: 'Batches do not add up to the actual / الدفعات لا تساوي الفعلي',
};

export function batchGapLabel(reason) {
  return LABEL[reason] || '';
}

/* One flat list across the departments handed in, so the report is a work queue
   rather than a tour. `rows(deptId)` and `name(row)` are supplied by the caller:
   this module reads no state and knows no department directory. */
export function collectBatchGaps(departments, rows, name) {
  const out = [];
  (Array.isArray(departments) ? departments : []).forEach((dept) => {
    const deptId = String((dept && dept.id) || dept || '');
    if (!deptId) return;
    let list = [];
    try { list = rows(deptId) || []; } catch (error) { list = []; }
    list.forEach((row) => {
      const reason = batchGapReason(row);
      if (!reason) return;
      out.push({
        deptId,
        deptName: String((dept && dept.name) || deptId),
        medName: String((name ? name(row) : '') || row.name || row.medName || row.medId || ''),
        actual: num(row.actualQty != null ? row.actualQty : row.qty),
        counted: (Array.isArray(row.batches) ? row.batches : []).reduce((c, b) => c + num(b && b.qty), 0),
        batches: (Array.isArray(row.batches) ? row.batches : []).length,
        reason,
      });
    });
  });
  /* Worst first: a row with no date at all cannot be printed, an uncounted one
     prints a lie, a mismatch is a discrepancy someone already half-recorded. */
  const rank = { 'no-expiry': 0, uncounted: 1, mismatch: 2 };
  return out.sort((a, b) => (rank[a.reason] - rank[b.reason]) || a.deptName.localeCompare(b.deptName) || a.medName.localeCompare(b.medName));
}
