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

// Phase 7a: Submit creates a pending report — NO deduction until pharmacy accepts.
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

  // Block new submission if a pending report already exists for this cart.
  const pendingIndex = nextReports.findIndex((entry) => (
    String(entry && entry.cartId || '') === String(cartId || '')
    && String(entry && entry.status || '') === 'pending'
  ));
  if (pendingIndex >= 0) {
    const pending = nextReports[pendingIndex];
    if (String(pending.deptId || '') !== String(departmentId || '')) {
      throw new Error('The existing report belongs to another department.');
    }
    // Allow re-submission by the same department: replace the pending report.
    // No restore needed — no deduction was made yet.
  }

  // Also handle legacy open reports (created before Phase 7a) — restore their deduction.
  const openIndex = nextReports.findIndex((entry) => (
    String(entry && entry.cartId || '') === String(cartId || '')
    && String(entry && entry.status || '') === 'open'
    && pendingIndex < 0
  ));
  const previousOpen = openIndex >= 0 ? nextReports[openIndex] : null;
  if (previousOpen) {
    if (String(previousOpen.deptId || '') !== String(departmentId || '')) {
      throw new Error('The existing report belongs to another department.');
    }
    if (previousOpen.inventoryDeductedAtReport === true) restoreReported(cart, previousOpen);
    nextReports.splice(openIndex, 1);
  }

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
    if (!(qty > 0)) throw new Error('Consumed quantity must be greater than zero.');
    const present = itemPresent(item);
    if (qty > present + 0.000001) throw new Error('Reported quantity exceeds the current cart quantity.');
    const reportedExpiry = dateKey(row.reportedExpiry);
    return {
      itemId,
      name: String(item.name || item.genericName || ''),
      strength: String(item.strength || item.concentration || ''),
      qty,
      max: present,
      reportedExpiry: reportedExpiry || '',
      // No deduction yet — deductionBatches filled when pharmacy accepts.
      deductionBatches: [],
      deductedQty: 0,
      deductedAtReport: false,
    };
  });

  const existingId = pendingIndex >= 0 ? nextReports[pendingIndex].id : null;
  const report = {
    id: existingId || `ccr_${randomUUID()}`,
    cartId: String(cartId),
    deptId: String(departmentId),
    reason: String(reason || '').trim(),
    oldSeal: String(oldSeal || '').trim() || (pendingIndex >= 0 ? nextReports[pendingIndex].oldSeal : '') || String(cart.seal || ''),
    consumed: normalized,
    status: 'pending',
    openedAt: (pendingIndex >= 0 ? nextReports[pendingIndex].openedAt : null) || stamp,
    openedBy: (pendingIndex >= 0 ? nextReports[pendingIndex].openedBy : null) || actorName,
    lastReportedAt: stamp,
    lastReportedBy: actorName,
    inventoryDeductedAtReport: false,
  };
  if (!report.reason) throw new Error('Select a reason for opening the Crash Cart.');
  if (report.reason.length > 500) throw new Error('Crash Cart report reason is too long.');

  if (pendingIndex >= 0) nextReports[pendingIndex] = report;
  else nextReports.push(report);

  return {
    carts: nextCarts,
    reports: nextReports,
    cart,
    report,
    updatedExisting: pendingIndex >= 0,
  };
}

// Phase 7a: Pharmacy accepts a pending report — execute deduction now.
function acceptCrashCartReport({
  carts,
  reports,
  reportId,
  actorName,
  stamp = new Date().toISOString(),
}) {
  const nextCarts = clone(Array.isArray(carts) ? carts : []);
  const nextReports = clone(Array.isArray(reports) ? reports : []);

  const reportIndex = nextReports.findIndex((entry) => String(entry && entry.id || '') === String(reportId || ''));
  if (reportIndex < 0) throw new Error('Report not found.');
  const report = nextReports[reportIndex];
  if (String(report.status || '') !== 'pending') {
    throw new Error('Only pending reports can be accepted.');
  }

  const cart = nextCarts.find((entry) => String(entry && entry.id || '') === String(report.cartId || ''));
  if (!cart) throw new Error('Crash Cart not found.');

  const consumedUpdated = (Array.isArray(report.consumed) ? report.consumed : []).map((row) => {
    const item = (cart.items || []).find((entry) => String(entry && entry.id || '') === String(row && row.itemId || ''));
    if (!item) throw new Error('A medicine in this report no longer exists in the Crash Cart.');
    const deduction = deductReported(item, row.qty, row.reportedExpiry, stamp, actorName);
    return { ...row, ...deduction };
  });

  nextReports[reportIndex] = {
    ...report,
    consumed: consumedUpdated,
    status: 'accepted',
    inventoryDeductedAtReport: true,
    inventoryDeductedAt: stamp,
    acceptedAt: stamp,
    acceptedBy: actorName,
  };

  return {
    carts: nextCarts,
    reports: nextReports,
    cart,
    report: nextReports[reportIndex],
  };
}

// Phase 7a: Pharmacy rejects a pending report — no inventory change.
function rejectCrashCartReport({
  reports,
  reportId,
  rejectionNote,
  actorName,
  stamp = new Date().toISOString(),
}) {
  const nextReports = clone(Array.isArray(reports) ? reports : []);

  const reportIndex = nextReports.findIndex((entry) => String(entry && entry.id || '') === String(reportId || ''));
  if (reportIndex < 0) throw new Error('Report not found.');
  const report = nextReports[reportIndex];
  if (String(report.status || '') !== 'pending') {
    throw new Error('Only pending reports can be rejected.');
  }

  nextReports[reportIndex] = {
    ...report,
    status: 'rejected',
    inventoryDeductedAtReport: false,
    rejectedAt: stamp,
    rejectedBy: actorName,
    rejectionNote: String(rejectionNote || '').slice(0, 500),
  };

  return {
    reports: nextReports,
    report: nextReports[reportIndex],
  };
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
  acceptCrashCartReport,
  rejectCrashCartReport,
  publicCrashCartPayload,
  restoreReported,
  deductReported,
};
