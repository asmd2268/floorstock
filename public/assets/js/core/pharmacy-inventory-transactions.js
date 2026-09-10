/* Turning a grid of typed rows into stock movements, and remembering where the
   stock was put.

   Two rules carry this, and both were buried in a DOM handler:

   Only the medicine and its location are required. Quantity, batch, expiry,
   supplier and note are recorded when known and left blank when not — refusing
   an entry over a batch number nobody has to hand just means the movement goes
   unrecorded, which is worse than an incomplete record.

   Choosing a shelf the medicine was not assigned to is how a new location gets
   created; that is the point of offering them. It is written onto the medicine
   as well, so the next entry lists it under "assigned" instead of asking again —
   but always AFTER the movements are saved, because a failure there must never
   cost the entry itself. */

export function buildTxnRecords({
  type = 'receipt',
  sharedDate = '',
  rows = [],
  actor = '',
  purgeDays = 365,
  now = Date.now(),
  newId = () => 'pitxn_' + Math.random().toString(36).slice(2),
} = {}) {
  const isReceipt = type === 'receipt';
  const records = [];
  const errors = [];
  const stamp = new Date(now).toISOString();
  const purgeAfter = new Date(now + purgeDays * 864e5).toISOString();

  rows.forEach((row, index) => {
    const medName = String((row && row.med) || '').trim();
    const location = String((row && row.location) || '').trim();
    const qty = parseFloat(row && row.qty) || 0;

    if (!medName) { errors.push(`Row ${index + 1}: medicine name required / اسم الدواء مطلوب`); return; }
    if (!location) { errors.push(`Row ${index + 1}: location required / الموقع مطلوب`); return; }
    if (qty < 0) { errors.push(`Row ${index + 1}: quantity cannot be negative / الكمية لا تكون سالبة`); return; }

    const [roomId = '', cabId = '', shelfId = ''] = location.split('|');
    const record = {
      id: newId(), type, medName, qty,
      date: sharedDate, createdAt: stamp, createdBy: actor, purgeAfter,
      expiry: String((row && row.expiry) || '').trim(),
      roomId, cabId, shelfId,
      note: String((row && row.note) || '').trim(),
    };
    if (isReceipt) {
      record.batchNo = String((row && row.batchNo) || '').trim();
      record.supplier = String((row && row.supplier) || '').trim();
    }
    records.push(record);
  });

  return { records, errors };
}

/* Medicines are matched by name, case- and space-insensitively, because that is
   what the person typing into the grid is matching against. A medicine the
   catalog does not know is not invented here — the movement is still recorded. */
export function applyNewLocations(meds, records) {
  const list = Array.isArray(meds) ? meds : [];
  const key = (value) => String(value || '').trim().toLowerCase();
  let added = 0;

  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!record || !record.shelfId) return;
    const med = list.find((entry) => key(entry && entry.name) === key(record.medName));
    if (!med) return;
    med.locations = med.locations || [];
    const already = med.locations.some((location) => location.roomId === record.roomId
      && location.cabId === record.cabId && location.shelfId === record.shelfId);
    if (already) return;
    med.locations.push({ roomId: record.roomId, cabId: record.cabId, shelfId: record.shelfId, expiry: '' });
    added++;
  });

  return { meds: list, added };
}
