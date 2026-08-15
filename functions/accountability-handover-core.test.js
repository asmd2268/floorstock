'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { canCreateHandover, createToken, hashToken, tokenMatches, applyPartyConfirmation, completeHandoverState } = require('./accountability-handover-core');

test('supervisor may create handovers and role aliases normalize', () => {
  assert.equal(canCreateHandover({ role: 'inpatient_supervisor' }), true);
  assert.equal(canCreateHandover({ role: 'inpatient_pharmacy_supervisor' }), true);
  assert.equal(canCreateHandover({ role: 'department' }), false);
});

test('handover tokens are random, hashed, and independently validated', () => {
  const first = createToken();
  const second = createToken();
  assert.notEqual(first, second);
  assert.equal(tokenMatches(first, hashToken(first)), true);
  assert.equal(tokenMatches(first, hashToken(second)), false);
});



test('first QR confirmation records one party without completing or replenishing anything', () => {
  const first = applyPartyConfirmation(
    { id: 's1', status: 'waiting_both_confirmations', pharmacyConfirmation: null, departmentConfirmation: null },
    'pharmacy',
    { name: 'Pharmacist', employeeId: 'P1' },
    '2026-07-30T09:55:00.000Z'
  );
  assert.equal(first.complete, false);
  assert.equal(first.alreadyConfirmed, false);
  assert.equal(first.session.status, 'pharmacy_confirmed');
  assert.equal(first.session.pharmacyConfirmation.employeeId, 'P1');
  assert.equal(first.session.departmentConfirmation, null);

  const repeated = applyPartyConfirmation(first.session, 'pharmacy', { name: 'Other', employeeId: 'P2' }, '2026-07-30T09:56:00.000Z');
  assert.equal(repeated.alreadyConfirmed, true);
  assert.equal(repeated.session.pharmacyConfirmation.employeeId, 'P1');

  const second = applyPartyConfirmation(first.session, 'department', { name: 'Nurse', employeeId: 'N1' }, '2026-07-30T10:00:00.000Z');
  assert.equal(second.complete, true);
  assert.equal(second.session.status, 'completed');
});

test('completion replenishes accountability balance only after both confirmations', () => {
  const state = completeHandoverState({
    assignments: [{ id: 'a1', medName: 'Independent Drug', quota: 10, balance: 6 }],
    usage: [{ id: 'u1', assignmentId: 'a1', deptId: 'd1', medName: 'Independent Drug', units: 4, status: 'approved_waiting_receipt' }],
    receipts: [],
    session: {
      id: 's1', deptId: 'd1', usageIds: ['u1'], departmentName: 'NICU',
      pharmacyConfirmation: { name: 'Pharmacist', employeeId: 'P1' },
      departmentConfirmation: { name: 'Nurse', employeeId: 'N1' }
    },
    nowIso: '2026-07-30T10:00:00.000Z'
  });
  assert.equal(state.assignments[0].balance, 10);
  assert.equal(state.usage[0].status, 'received_locked');
  assert.equal(state.receipts[0].confirmationMethod, 'temporary_dual_qr');
  assert.equal(state.receipts[0].medicineTotals[0].medName, 'Independent Drug');
});

test('completion auto-recreates a custody record deleted mid-handover instead of failing', () => {
  const state = completeHandoverState({
    assignments: [],
    usage: [{ id: 'u1', assignmentId: 'a-deleted', deptId: 'd1', medName: 'Reteplase', units: 1, status: 'approved_waiting_receipt' }],
    receipts: [],
    session: {
      id: 's1', deptId: 'd1', usageIds: ['u1'], departmentName: 'ICU',
      pharmacyConfirmation: { name: 'Pharmacist', employeeId: 'P1' },
      departmentConfirmation: { name: 'Nurse', employeeId: 'N1' }
    },
    nowIso: '2026-08-16T10:00:00.000Z'
  });
  const recreated = state.assignments.find((row) => row.id === 'a-deleted');
  assert.ok(recreated);
  assert.equal(recreated.balance, 1);
  assert.equal(recreated.quota, 1);
  assert.equal(recreated.deptId, 'd1');
  assert.equal(state.usage[0].status, 'received_locked');
  assert.equal(state.receipts[0].totalUnits, 1);
});
