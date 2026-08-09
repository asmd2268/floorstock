'use strict';

const { randomUUID } = require('node:crypto');

function clone(value) {
  return JSON.parse(JSON.stringify(value == null ? null : value));
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateKey(value) {
  return String(value || '').slice(0, 10);
}

function itemPresent(item) {
  return number(item && item.present != null ? item.present : item && item.qty);
}

function itemStandard(item) {
  return number(item && item.qty);
}

function restoreReported(cart, report) {
  if (!report || report.inventoryDeductedAtReport !== true) return;
  const items = Array.isArray(cart.items) ? cart.items : [];
  for (const row of Array.isArray(report.consumed) ? report.consumed : []) {
    const item = items.find((entry) => String(entry && entry.id || '') === String(row && row.itemId || ''));
    if (!item) continue;
    const batches = Array.isArray(item.batches) ? item.batches.map((batch) => ({ ...batch })) : [];
    for (const part of Array.isArray(row.deductionBatches) ? row.deductionBatches : []) {
      const target = batches.find((batch) => (
        (part.batchId && String(batch.batchId || batch.id || '') === String(part.batchId))
        || (!part.batchId
          && dateKey(batch.expiry) === dateKey(part.expiry)
          && String(batch.lot || batch.batch || '') === String(part.lot || ''))
      ));
      if (target) target.qty = number(target.qty) + number(part.qty);
      else {
        batches.push({
          batchId: part.batchId || `ccb_${randomUUID()}`,
          expiry: dateKey(part.expiry),
          lot: String(part.lot || ''),
          qty: number(part.qty),
          source: 'restored_report_edit',
        });
      }
    }
    item.batches = batches;
    item.present = Math.min(itemStandard(item), itemPresent(item) + number(row.deductedQty || row.qty));
    item.stockStatus = item.present <= 0 ? 'out_of_stock' : item.present < itemStandard(item) ? 'partial' : 'available';
  }
}

function deductReported(item, qty, reportedExpiry, stamp, actorName) {
  const requested = number(qty);
  const present = itemPresent(item);
  if (!(requested > 0)) throw new Error('Consumed quantity must be greater than zero.');
  if (requested > present + 0.000001) throw new Error('Reported quantity exceeds the current cart quantity.');

  let left = requested;
  const taken = [];
  const batches = Array.isArray(item.batches) ? item.batches.map((batch) => ({ ...batch })) : [];
  const ordered = batches
    .map((batch, index) => ({ batch, index }))
    .filter((entry) => number(entry.batch.qty) > 0 && (!reportedExpiry || dateKey(entry.batch.expiry) === dateKey(reportedExpiry)))
    .sort((leftEntry, rightEntry) => (
      dateKey(leftEntry.batch.expiry).localeCompare(dateKey(rightEntry.batch.expiry))
      || leftEntry.index - rightEntry.index
    ));

  for (const entry of ordered) {
    if (left <= 0) break;
    const amount = Math.min(left, number(entry.batch.qty));
    if (!(amount > 0)) continue;
    entry.batch.qty = number(entry.batch.qty) - amount;
    left -= amount;
    taken.push({
      batchId: entry.batch.batchId || entry.batch.id || '',
      expiry: dateKey(entry.batch.expiry),
      lot: entry.batch.lot || entry.batch.batch || '',
      qty: amount,
    });
  }

  if (reportedExpiry && left > 0.000001) {
    throw new Error('The selected expiry does not contain enough quantity.');
  }

  item.batches = batches.filter((batch) => number(batch.qty) > 0);
  item.present = Math.max(0, present - requested);
  item.stockStatus = item.present <= 0 ? 'out_of_stock' : item.present < itemStandard(item) ? 'partial' : 'available';
  item.updatedAt = stamp;
  item.updatedBy = actorName;

  return {
    deductionBatches: taken,
    untrackedDeductedQty: Math.max(0, left),
    deductedQty: requested,
    deductedAtReport: true,
  };
}

function applyCrashCartReport({
  carts,
  reports,
  cartId,
  departmentId,
  reason,
  oldSeal,
  consumed,
  actorName,
  stamp = new Date().toISOString(),
}) {
  const nextCarts = clone(Array.isArray(carts) ? carts : []);
  const nextReports = clone(Array.isArray(reports) ? reports : []);
  const cart = nextCarts.find((entry) => String(entry && entry.id || '') === String(cartId || ''));
  if (!cart) throw new Error('Crash Cart not found.');
  if (String(cart.deptId || cart.departmentId || '') !== String(departmentId || '')) {
    throw new Error('This Crash Cart is not assigned to the authenticated department.');
  }

  const existingIndex = nextReports.findIndex((entry) => (
    String(entry && entry.cartId || '') === String(cartId || '')
    && String(entry && entry.status || '') === 'open'
  ));
  const previous = existingIndex >= 0 ? nextReports[existingIndex] : null;
  if (previous && String(previous.deptId || '') !== String(departmentId || '')) {
    throw new Error('The existing report belongs to another department.');
  }
  if (previous && previous.inventoryDeductedAtReport === true) restoreReported(cart, previous);

  const rows = Array.isArray(consumed) ? consumed : [];
  if (!rows.length) throw new Error('Select at least one medication and enter its quantity.');
  if (rows.length > 100) throw new Error('Too many Crash Cart report lines.');

  const seen = new Set();
  const normalized = rows.map((row) => {
    const itemId = String(row && row.itemId || '').trim();
    if (!itemId || seen.has(itemId)) throw new Error('Crash Cart report contains an invalid or duplicate medicine line.');
    seen.add(itemId);
    const item = (cart.items || []).find((entry) => String(entry && entry.id || '') === itemId);
    if (!item) throw new Error('A selected medicine no longer exists in the Crash Cart.');
    const qty = number(row.qty);
    const reportedExpiry = dateKey(row.reportedExpiry);
    const max = itemPresent(item);
    const deduction = deductReported(item, qty, reportedExpiry, stamp, actorName);
    return {
      itemId,
      name: String(item.name || item.genericName || ''),
      strength: String(item.strength || item.concentration || ''),
      qty,
      max,
      reportedExpiry: reportedExpiry || '',
      ...deduction,
    };
  });

  const report = {
    id: previous && previous.id || `ccr_${randomUUID()}`,
    cartId: String(cartId),
    deptId: String(departmentId),
    reason: String(reason || '').trim(),
    oldSeal: String(oldSeal || '').trim() || (previous && previous.oldSeal) || String(cart.seal || ''),
    consumed: normalized,
    status: 'open',
    openedAt: previous && previous.openedAt || stamp,
    openedBy: previous && previous.openedBy || actorName,
    lastReportedAt: stamp,
    lastReportedBy: actorName,
    inventoryDeductedAtReport: true,
    inventoryDeductedAt: stamp,
  };
  if (!report.reason) throw new Error('Select a reason for opening the Crash Cart.');
  if (report.reason.length > 500) throw new Error('Crash Cart report reason is too long.');

  if (existingIndex >= 0) nextReports[existingIndex] = report;
  else nextReports.push(report);

  return { carts: nextCarts, reports: nextReports, cart, report, updatedExisting: existingIndex >= 0 };
}

function publicCrashCartPayload(cart) {
  const items = (Array.isArray(cart && cart.items) ? cart.items : []).map((item) => ({
    id: String(item && item.id || ''),
    name: String(item && (item.name || item.genericName) || ''),
    genericName: String(item && (item.genericName || item.name) || ''),
    strength: String(item && (item.strength || item.concentration) || ''),
    concentration: String(item && (item.concentration || item.strength) || ''),
    qty: itemStandard(item),
    present: itemPresent(item),
    stockStatus: String(item && item.stockStatus || ''),
    batches: (Array.isArray(item && item.batches) ? item.batches : []).map((batch) => ({
      expiry: dateKey(batch && batch.expiry),
      qty: number(batch && batch.qty),
      lot: String(batch && (batch.lot || batch.batch) || ''),
    })),
  }));
  const departmentId = String(cart && (cart.deptId || cart.departmentId) || '');
  const department = String(cart && (cart.deptName || cart.departmentName) || '');
  const summary = {
    id: String(cart && cart.id || ''),
    name: String(cart && cart.name || 'Crash Cart'),
    number: String(cart && cart.number || ''),
    location: String(cart && cart.location || ''),
    departmentId,
    department,
    items,
  };
  return {
    scope: 'crash_cart',
    cartId: summary.id,
    departmentId,
    department,
    name: summary.name,
    number: summary.number,
    location: summary.location,
    items,
    rows: items,
    cart: summary,
  };
}

module.exports = {
  applyCrashCartReport,
  publicCrashCartPayload,
  restoreReported,
  deductReported,
};
