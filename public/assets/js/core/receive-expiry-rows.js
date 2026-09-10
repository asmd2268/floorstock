/* Turning what a department typed on the receipt screen into expiry records.

   A delivery of one medicine can arrive as more than one expiry date — two
   boxes with different dates is the ordinary case — so the screen lets a person
   add a date and split the quantity. This is where that split is checked.

   The parts must add up to what was received. Not fewer: the missing units
   would sit in the department with no expiry recorded, which is exactly what
   the expiry screen exists to prevent. Not more: the record would claim stock
   nobody delivered.

   A row with no date and no quantity is someone who added a line and changed
   their mind — dropped, not an error. A row with a quantity and no date is an
   error, because that quantity has nowhere to live. */

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

export function buildReceiveRecords(rows, { requestId = '', now = new Date().toISOString(), newId } = {}) {
  const byMedicine = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const medId = String((row && row.medId) || '');
    if (!medId) return;
    if (!byMedicine.has(medId)) byMedicine.set(medId, { received: num(row.received), lines: [] });
    const entry = byMedicine.get(medId);
    /* The received total is a property of the medicine, not of the row. */
    if (num(row.received) > entry.received) entry.received = num(row.received);
    entry.lines.push({ expiry: String(row.expiry || '').trim(), qty: num(row.qty), lot: String(row.lot || '').trim() });
  });

  const errors = [];
  const records = [];
  const received = [];

  byMedicine.forEach((entry, medId) => {
    const used = entry.lines.filter((line) => line.expiry || line.qty > 0);
    if (!used.length) return;  // nothing entered for this medicine yet

    const missingDate = used.find((line) => line.qty > 0 && !line.expiry);
    if (missingDate) { errors.push({ medId, reason: 'quantity-without-date' }); return; }

    const total = used.reduce((sum, line) => sum + line.qty, 0);
    if (Math.abs(total - entry.received) > 1e-6) {
      errors.push({ medId, reason: 'split-mismatch', total, received: entry.received });
      return;
    }

    used.forEach((line) => {
      if (!line.expiry) return;
      records.push({
        id: typeof newId === 'function' ? newId() : `ex_${Math.random().toString(36).slice(2, 10)}`,
        medId, expiry: line.expiry, date: line.expiry,
        batch: line.lot, lot: line.lot, qty: line.qty,
        sourceRequestId: requestId, receivedAt: now,
      });
      received.push({ medId, qty: line.qty, expiry: line.expiry, batch: line.lot });
    });
  });

  return { records, received, errors };
}

export function describeReceiveError(error, nameOf = (id) => id) {
  const name = nameOf(error.medId);
  if (error.reason === 'quantity-without-date') {
    return `${name}: a quantity was entered with no expiry date. / أُدخلت كمية بلا تاريخ انتهاء.`;
  }
  return `${name}: the dates account for ${error.total} of ${error.received} received. / التواريخ تغطي ${error.total} من ${error.received}.`;
}
