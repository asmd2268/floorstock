'use strict';

const { number, dateKey, itemPresent, itemStandard } = require('./crash-cart-report-core');

/* Closing a Crash Cart report: the pharmacy's answer, applied server-side.

   It used to happen in the browser as two separate writes — save every trolley,
   then save the report — with a hand-written rollback of the first if the second
   failed. Two things follow from that, and both are the reason this moved:

     the arithmetic was the browser's. What came back was whatever the page had
     calculated: how much to take off which batch, and what to put back. The
     rules could only check that a pharmacist wrote a well-shaped document, never
     that the quantities added up.

     and the pair was not atomic. A refused second write left the trolley already
     changed; a browser closed between them left it changed with no rollback at
     all — a sealed emergency trolley recorded as holding something it does not.

   So the client now sends what the PHARMACIST decided — which batch each
   replacement belongs to, how many, and whether an item is unavailable — and the
   quantities are worked out here, inside one transaction with the report.

   Everything in this file is pure, so each rule below is provable without a
   database. */

function clone(value) {
  return JSON.parse(JSON.stringify(value == null ? null : value));
}

/* Takes `qty` off the batches carrying `expiry`, oldest lot first, and refuses
   rather than going negative — the quantity has to exist to be removed. */
function removeFromExpiry(item, expiry, qty) {
  let left = number(qty);
  if (left <= 0) return;
  const wanted = dateKey(expiry);
  const batches = Array.isArray(item.batches) ? item.batches : [];
  const available = batches
    .filter((batch) => dateKey(batch && batch.expiry) === wanted)
    .reduce((total, batch) => total + number(batch.qty), 0);
  if (available + 0.000001 < left) {
    throw new Error(`${item.name || 'Medicine'}: batch ${wanted} holds ${available}, which is less than the ${left} being deducted.`);
  }
  const next = [];
  batches.forEach((batch) => {
    const copy = Object.assign({}, batch);
    if (left > 0 && dateKey(copy.expiry) === wanted) {
      const take = Math.min(left, number(copy.qty));
      copy.qty = number(copy.qty) - take;
      left -= take;
    }
    if (number(copy.qty) > 0) next.push(copy);
  });
  item.batches = next;
}

function addDatedQuantity(item, expiry, qty, reportId) {
  const amount = number(qty);
  if (amount <= 0) return;
  const wanted = dateKey(expiry);
  if (!wanted) throw new Error(`${item.name || 'Medicine'}: a replacement quantity needs an expiry date.`);
  const batches = Array.isArray(item.batches) ? item.batches.map((batch) => Object.assign({}, batch)) : [];
  const existing = batches.find((batch) => dateKey(batch.expiry) === wanted && !String(batch.lot || '').trim());
  if (existing) existing.qty = number(existing.qty) + amount;
  else batches.push({ qty: amount, expiry: wanted, lot: '', addedBy: reportId || '' });
  item.batches = batches;
}

function itemTotalFromBatches(item) {
  return (Array.isArray(item.batches) ? item.batches : []).reduce((total, batch) => total + number(batch.qty), 0);
}

/* rows: what the pharmacist decided, one per cart item they touched
     itemId        the cart item
     unavailable   true  -> nothing replaced; the cart stays short of it
     sourceExpiry  the batch the reported quantity comes off (when not deducted
                   at report time)
     removeQty     how much to take off that batch
     qty/expiry    the replacement quantity and the date it carries */
function closeCrashCartReport({ carts, reports, reportId, seal, note, rows, actor, stamp }) {
  const nextCarts = clone(Array.isArray(carts) ? carts : []);
  const nextReports = clone(Array.isArray(reports) ? reports : []);
  const report = nextReports.find((entry) => String(entry && entry.id || '') === String(reportId || ''));
  if (!report) throw new Error('This Crash Cart report no longer exists.');
  if (report.status !== 'open' && report.status !== 'pending') {
    throw new Error('This report has already been answered.');
  }
  const cart = nextCarts.find((entry) => String(entry && entry.id || '') === String(report.cartId || ''));
  if (!cart) throw new Error('The Crash Cart for this report no longer exists.');
  const newSeal = String(seal || '').trim();
  if (!newSeal) throw new Error('A new seal number is required to close the cart.');

  const alreadyDeducted = report.inventoryDeductedAtReport === true;
  const replacements = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const itemId = String(row && row.itemId || '');
    const item = (cart.items || []).find((entry) => String(entry && entry.id || '') === itemId);
    if (!item) throw new Error('A medicine in this response no longer exists in the cart.');

    const unavailable = row.unavailable === true;
    const replacementQty = unavailable ? 0 : number(row.qty);
    const removeQty = alreadyDeducted || unavailable ? 0 : number(row.removeQty);
    if (replacementQty < 0) throw new Error(`${item.name || 'Medicine'}: a replacement quantity cannot be negative.`);

    if (removeQty > 0) {
      const source = dateKey(row.sourceExpiry);
      if (!source) throw new Error(`${item.name || 'Medicine'}: choose the batch this quantity is deducted from.`);
      removeFromExpiry(item, source, removeQty);
    }
    if (replacementQty > 0) addDatedQuantity(item, row.expiry, replacementQty, report.id);

    /* The cart's own count follows its batches, so what the screen shows and
       what the batches hold cannot drift apart. */
    const present = itemTotalFromBatches(item);
    const standard = itemStandard(item);
    if (present > standard + 0.000001) {
      throw new Error(`${item.name || 'Medicine'}: the result ${present} is above the cart standard ${standard}.`);
    }
    item.present = present;
    item.stockStatus = present <= 0 ? 'out_of_stock' : (present < standard ? 'partial' : 'available');

    replacements.push({
      itemId,
      name: String(item.name || ''),
      unavailable,
      action: unavailable ? 'add' : 'replace',
      sourceExpiry: removeQty > 0 ? dateKey(row.sourceExpiry) : '',
      reportedQty: removeQty,
      qty: replacementQty,
      expiry: replacementQty > 0 ? dateKey(row.expiry) : '',
      result: present,
      standard,
    });
  });

  const when = stamp || new Date().toISOString();
  const actorName = String((actor && actor.name) || 'Pharmacy');
  cart.seal = newSeal;
  cart.updatedAt = when;
  cart.updatedBy = actorName;
  cart.lastClosedByName = actorName;
  cart.lastClosedByUser = String((actor && actor.login) || '');
  cart.lastClosedAt = when;

  report.status = 'closed';
  report.closedAt = when;
  report.closedBy = actorName;
  report.closedByName = actorName;
  report.closedByUser = String((actor && actor.login) || '');
  report.closedById = String((actor && actor.id) || '');
  report.newSeal = newSeal;
  report.pharmacyNote = String(note || '').trim().slice(0, 500);
  report.replacements = replacements;
  report.lastEditedAt = when;
  report.lastEditedBy = actorName;
  report.lastEditedByName = actorName;

  return { carts: nextCarts, reports: nextReports, cart, report, replacements };
}

module.exports = {
  closeCrashCartReport,
  removeFromExpiry,
  addDatedQuantity,
  itemTotalFromBatches,
};
