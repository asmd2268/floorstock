/* The three questions the pharmacy inventory's report tab answers.

   What has not come in, what has not gone out, and what moved in a period.

   "Not received since" and "not dispensed since" are asked against the whole
   medicine list, not against the movements — a medicine that has NEVER been
   received is exactly what the report is looking for, and one that only appears
   in the movements can never be missing from them. A medicine with no movement
   at all is reported with no date rather than dropped.

   The period summary counts both directions per medicine and nets them, so a
   line reading -30 says the shelf gave out thirty more than it took in over
   those dates. Both end dates are inclusive: a report "from the 1st to the 31st"
   that quietly excluded the 31st would under-count every month-end.

   Lifted out of a render function in modules/84 that read its filters from the
   DOM and built HTML in the same pass. */

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function nameOf(txn) { return String((txn && txn.medName) || '').trim(); }

/* The last date each medicine moved in the given direction. */
export function lastMovementByMedicine(transactions, type) {
  const latest = {};
  (Array.isArray(transactions) ? transactions : []).forEach((txn) => {
    if (!txn || txn.type !== type) return;
    const key = nameOf(txn);
    const date = String(txn.date || '');
    if (!key || !date) return;
    if (!latest[key] || date > latest[key]) latest[key] = date;
  });
  return latest;
}

export function inactiveSince(transactions, medicines, type, cutoffDate) {
  const latest = lastMovementByMedicine(transactions, type);
  return (Array.isArray(medicines) ? medicines : [])
    .map((medicine) => String(medicine || '').trim())
    .filter(Boolean)
    .filter((medicine) => !latest[medicine] || latest[medicine] < cutoffDate)
    .map((medicine) => ({ medicine, lastDate: latest[medicine] || null }));
}

export function cutoffDaysAgo(days, now = Date.now()) {
  return new Date(now - Math.max(1, num(days)) * 864e5).toISOString().slice(0, 10);
}

export function periodSummary(transactions, { from = '', to = '', medicine = '' } = {}) {
  const needle = String(medicine || '').trim().toLowerCase();
  const totals = {};

  (Array.isArray(transactions) ? transactions : []).forEach((txn) => {
    if (!txn) return;
    const date = String(txn.date || '');
    if (from && date < from) return;
    if (to && date > to) return;
    const key = nameOf(txn);
    if (!key) return;
    if (needle && key.toLowerCase().indexOf(needle) < 0) return;
    if (!totals[key]) totals[key] = { received: 0, dispensed: 0 };
    if (txn.type === 'receipt') totals[key].received += num(txn.qty);
    else totals[key].dispensed += num(txn.qty);
  });

  const rows = Object.keys(totals).sort().map((key) => ({
    medicine: key,
    received: totals[key].received,
    dispensed: totals[key].dispensed,
    net: totals[key].received - totals[key].dispensed,
  }));

  return {
    rows,
    totals: rows.reduce((sum, row) => ({
      received: sum.received + row.received,
      dispensed: sum.dispensed + row.dispensed,
      net: sum.net + row.net,
    }), { received: 0, dispensed: 0, net: 0 }),
  };
}
