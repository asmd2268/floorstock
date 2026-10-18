/* Turning what a department chose on the receipt screen into expiry records.

   The department does NOT type a quantity here. How many units were sent is the
   pharmacy's fact, recorded when it dispensed the order; the ward only says
   WHICH expiry dates the delivered stock carries. For each dispensed medicine it
   either ticks dates the department already holds on its own expiry list, or adds
   a date that is not there yet — and one delivery may carry several dates, so
   both can be done more than once.

   What this module decides:
   - every dispensed medicine needs at least one date, otherwise the delivery
     would sit in the department with no expiry recorded, which is exactly what
     the expiry screen exists to prevent;
   - a date the department already holds is never written twice — ticking it and
     typing it again are the same act, and the list's own normaliser would merge
     the two and turn an unrecorded quantity into zero;
   - a date added here is saved with qty null. Blank is UNRECORDED, never 0: on a
     pharmacy register 0 asserts "none left" about stock the ward holds.

   A row with no date and no batch is someone who added a line and changed their
   mind — dropped, not an error. A batch number with no date is an error, because
   a batch with no expiry has nothing to attach to. */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function text(value) { return String(value == null ? '' : value).trim(); }
function dateOf(row) { return text(row && (row.date || row.expiry || row.expiryDate)).slice(0, 10); }
function lotOf(row) { return text(row && (row.lot || row.batch || row.batchNo || row.lotNo)); }
function identity(medId, date, lot) { return [medId, date, lot.toLowerCase()].join('|'); }
function recordId(row) { return text(row && (row.id || row.batchId)); }

/* rows: [{ medId, existingId?, expiry?, lot? }]
     existingId set  -> the person ticked a date the department already holds
     existingId blank -> the person typed a new date (expiry, optional lot)
   existing: the department's current expiry rows.
   required: medicine ids that were dispensed and must each end with a date. */
export function buildReceiveRecords(rows, {
  requestId = '', now = new Date().toISOString(), newId, existing = [], required = [],
} = {}) {
  const held = Array.isArray(existing) ? existing : [];
  const heldById = new Map();
  const heldByIdentity = new Map();
  held.forEach((row) => {
    const id = recordId(row);
    if (id) heldById.set(id, row);
    heldByIdentity.set(identity(text(row && row.medId), dateOf(row), lotOf(row)), row);
  });

  const errors = [];
  const records = [];
  const received = [];
  const seen = new Set();
  const covered = new Set();
  const failed = new Set();

  const fail = (medId, reason, extra) => {
    if (failed.has(medId)) return;
    failed.add(medId);
    errors.push({ medId, reason, ...(extra || {}) });
  };

  const remember = (medId, date, lot, source, id) => {
    const key = identity(medId, date, lot);
    if (seen.has(key)) return;               // the same date twice is one date
    seen.add(key);
    covered.add(medId);
    received.push({ medId, expiry: date, batch: lot, source, ...(id ? { batchId: id } : {}) });
  };

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const medId = text(row && row.medId);
    if (!medId) return;

    const existingId = text(row.existingId);
    if (existingId) {
      const match = heldById.get(existingId);
      if (!match || text(match.medId) !== medId) { fail(medId, 'stale-selection'); return; }
      remember(medId, dateOf(match), lotOf(match), 'existing', existingId);
      return;
    }

    const date = dateOf(row);
    const lot = lotOf(row);
    if (!date && !lot) return;               // added a line and changed their mind
    if (!date) { fail(medId, 'batch-without-date'); return; }
    if (!DATE_ONLY.test(date)) { fail(medId, 'invalid-date', { value: date }); return; }

    /* A date the department already holds is a selection, not a new record. */
    const same = heldByIdentity.get(identity(medId, date, lot));
    if (same) { remember(medId, date, lot, 'existing', recordId(same)); return; }

    const key = identity(medId, date, lot);
    if (seen.has(key)) return;
    records.push({
      id: typeof newId === 'function' ? newId() : `ex_${Math.random().toString(36).slice(2, 10)}`,
      medId, expiry: date, date,
      batch: lot, lot, qty: null,
      sourceRequestId: requestId, receivedAt: now,
    });
    remember(medId, date, lot, 'new');
  });

  (Array.isArray(required) ? required : []).forEach((id) => {
    const medId = text(id);
    if (medId && !covered.has(medId)) fail(medId, 'no-date');
  });

  return errors.length ? { records: [], received: [], errors } : { records, received, errors };
}

export function describeReceiveError(error, nameOf = (id) => id) {
  const name = nameOf(error.medId);
  switch (error.reason) {
    case 'batch-without-date':
      return `${name}: a batch number was entered with no expiry date. / ${name}: أُدخل رقم دفعة بلا تاريخ انتهاء.`;
    case 'invalid-date':
      return `${name}: the expiry date is not valid. / ${name}: تاريخ الانتهاء غير صالح.`;
    case 'stale-selection':
      return `${name}: a selected date is no longer on the department list — reopen the receipt. / ${name}: تاريخ مختار لم يعد في قائمة القسم — أعد فتح الاستلام.`;
    default:
      return `${name}: choose or add at least one expiry date. / ${name}: اختر أو أضف تاريخ انتهاء واحد على الأقل.`;
  }
}
