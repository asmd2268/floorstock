'use strict';

const crypto = require('node:crypto');

function publicError(message, statusCode) {
  const error = new Error(message);
  error.publicMessage = message;
  error.statusCode = statusCode || 409;
  return error;
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'pharmacy_director') return 'pharmacy';
  if (role === 'inpatient_pharmacy_supervisor' || role === 'inpatient pharmacy supervisor') return 'inpatient_supervisor';
  return role;
}

function canCreateHandover(profile) {
  const role = normalizeRole(profile && profile.role);
  return (profile && profile.master === true && role === 'pharmacy') ||
    ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff'].includes(role);
}

function createToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function tokenMatches(value, expectedHash) {
  const actual = Buffer.from(hashToken(value), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && actual.length > 0 && crypto.timingSafeEqual(actual, expected);
}

function cleanIdentity(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, maxLength || 120);
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function medicineTotals(selected, assignments) {
  const byAssignment = new Map();
  for (const row of selected) {
    const id = String(row.assignmentId || '');
    const current = byAssignment.get(id) || { assignmentId: id, medName: row.medName || '', units: 0 };
    current.units += number(row.units);
    byAssignment.set(id, current);
  }
  const assignmentMap = new Map((assignments || []).map((item) => [String(item.id), item]));
  return [...byAssignment.values()].map((item) => ({
    ...item,
    medName: (assignmentMap.get(item.assignmentId) || {}).medName || item.medName || 'Medicine'
  }));
}


function applyPartyConfirmation(session, party, identity, nowIso) {
  if (!['pharmacy', 'department'].includes(party)) throw publicError('Invalid handover party.');
  const next = { ...(session || {}) };
  const field = party === 'pharmacy' ? 'pharmacyConfirmation' : 'departmentConfirmation';
  if (next[field]) {
    return { session: next, alreadyConfirmed: true, complete: !!(next.pharmacyConfirmation && next.departmentConfirmation) };
  }
  next[field] = {
    name: cleanIdentity(identity && identity.name, 120),
    employeeId: cleanIdentity(identity && identity.employeeId, 60),
    confirmedAt: nowIso,
    party
  };
  const complete = !!(next.pharmacyConfirmation && next.departmentConfirmation);
  next.status = complete ? 'completed' : (party === 'pharmacy' ? 'pharmacy_confirmed' : 'department_confirmed');
  return { session: next, alreadyConfirmed: false, complete };
}

function completeHandoverState({ assignments, usage, receipts, session, nowIso }) {
  const usageIds = new Set((session.usageIds || []).map(String));
  const nextAssignments = (assignments || []).map((row) => ({ ...row }));
  const nextUsage = (usage || []).map((row) => ({ ...row }));
  const selected = nextUsage.filter((row) => usageIds.has(String(row.id)));
  if (selected.length !== usageIds.size) throw publicError('One or more accountability records are missing.');
  if (selected.some((row) => row.status !== 'approved_waiting_receipt')) {
    throw publicError('One or more accountability records are no longer waiting for receipt.');
  }
  if (selected.some((row) => String(row.deptId) !== String(session.deptId))) {
    throw publicError('The selected accountability records do not belong to one department.');
  }

  const totals = medicineTotals(selected, nextAssignments);
  for (const total of totals) {
    let assignment = nextAssignments.find((row) => String(row.id) === total.assignmentId);
    if (!assignment) {
      // The custody record was deleted after this usage entered the handover
      // pipeline (e.g. a master removed it mid-flight). Recreate a minimal
      // record so the already-in-progress receipt can still complete instead
      // of leaving the department permanently unable to confirm; quota is
      // capped to exactly what is being received here, so it carries no more
      // authority than this one receipt until someone reviews it.
      assignment = {
        id: total.assignmentId,
        deptId: session.deptId,
        medName: total.medName || 'Medicine',
        quota: total.units,
        balance: 0,
        reasons: [],
        active: true,
        createdAt: nowIso,
        createdBy: 'Auto-recreated by handover receipt (original custody record was deleted before receipt)',
        recreatedFromHandover: session.id
      };
      nextAssignments.push(assignment);
    }
    const quota = number(assignment.quota);
    // balance was decremented when usage was submitted; receipt restores it, capped at quota
    assignment.balance = Math.min(quota, number(assignment.balance) + total.units);
    assignment.updatedAt = nowIso;
    assignment.updatedBy = session.departmentConfirmation.name;
  }

  const receiptId = `acc2receipt_qr_${session.id}`;
  for (const row of selected) {
    row.status = 'received_locked';
    row.receiptId = receiptId;
    row.receivedAt = nowIso;
    row.receivedDate = nowIso.slice(0, 10);
    row.deliveredByPharmacy = session.pharmacyConfirmation.name;
    row.deliveredByPharmacyEmployeeId = session.pharmacyConfirmation.employeeId;
    row.receivedByNurse = session.departmentConfirmation.name;
    row.receivedByEmployeeId = session.departmentConfirmation.employeeId;
    row.locked = true;
    row.lockedAt = nowIso;
    row.handoverStatus = 'completed';
  }

  const receipt = {
    id: receiptId,
    handoverSessionId: session.id,
    deptId: session.deptId,
    departmentName: session.departmentName || '',
    pharmacyName: session.pharmacyConfirmation.name,
    pharmacyEmployeeId: session.pharmacyConfirmation.employeeId,
    nurseName: session.departmentConfirmation.name,
    departmentEmployeeId: session.departmentConfirmation.employeeId,
    receivedDate: nowIso.slice(0, 10),
    receivedAt: nowIso,
    usageIds: [...usageIds],
    totalUnits: selected.reduce((sum, row) => sum + number(row.units), 0),
    medicineTotals: totals,
    createdAt: nowIso,
    createdBy: 'Temporary dual QR confirmation',
    createdByUser: 'public-qr',
    locked: true,
    confirmationMethod: 'temporary_dual_qr'
  };
  const nextReceipts = (receipts || []).some((row) => String(row.id) === receiptId)
    ? (receipts || []).map((row) => String(row.id) === receiptId ? receipt : row)
    : (receipts || []).concat([receipt]);

  return { assignments: nextAssignments, usage: nextUsage, receipts: nextReceipts, receipt };
}

module.exports = {
  normalizeRole,
  canCreateHandover,
  createToken,
  hashToken,
  tokenMatches,
  cleanIdentity,
  // Exported so the accountability balance arithmetic in index.js uses this same
  // coercion (non-finite and negative inputs collapse to 0) rather than a
  // second, divergent copy.
  number,
  medicineTotals,
  applyPartyConfirmation,
  completeHandoverState
};
