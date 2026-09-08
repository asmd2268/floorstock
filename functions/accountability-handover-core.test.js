'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { canCreateHandover, createToken, hashToken, tokenMatches, applyPartyConfirmation, pharmacyConfirmationFromAccount, completeHandoverState } = require('./accountability-handover-core');

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



test('the pharmacist is taken from the account, not from a second QR', () => {
  /* The pharmacist used to scan their own code and retype their name and employee
     number. They are the signed-in user who just pressed Create, so that step was
     redundant — it added a code to distribute and a way for a handover to stall
     with nobody having received anything. User profiles carry no employee-number
     field, so the account's email is the identifier recorded. */
  const stamped = pharmacyConfirmationFromAccount(
    { displayName: 'Ahmed Al-Qahtani', email: 'ahmed@hospital.sa', uid: 'u1' },
    '2026-07-30T09:55:00.000Z',
  );
  assert.equal(stamped.name, 'Ahmed Al-Qahtani');
  assert.equal(stamped.employeeId, 'ahmed@hospital.sa');
  assert.equal(stamped.party, 'pharmacy');
  assert.equal(stamped.fromAccount, true, 'a receipt can tell an account stamp from a typed one');

  // An account with no display name still yields something nameable.
  const emailOnly = pharmacyConfirmationFromAccount({ email: 'x@y.z', uid: 'u2' }, '2026-07-30T09:55:00.000Z');
  assert.equal(emailOnly.name, 'x@y.z');
  const bare = pharmacyConfirmationFromAccount({ uid: 'u3' }, '2026-07-30T09:55:00.000Z');
  assert.equal(bare.name, 'u3');
  assert.ok(bare.name.length > 0, 'a receipt must never name nobody');
});

test('a handover created since the change needs only the department to confirm', () => {
  // The session arrives with the pharmacist already recorded and no pharmacy
  // token, so there is nothing for a pharmacy link to match.
  const session = {
    id: 's1',
    status: 'pharmacy_confirmed',
    departmentTokenHash: 'abc',
    pharmacyConfirmation: pharmacyConfirmationFromAccount({ displayName: 'Pharmacist', email: 'p@h.sa' }, '2026-07-30T09:55:00.000Z'),
    departmentConfirmation: null,
  };
  assert.throws(
    () => applyPartyConfirmation(session, 'pharmacy', { name: 'Someone', employeeId: 'X' }, '2026-07-30T09:56:00.000Z'),
    /only needs the receiving department/,
    'a pharmacy confirmation has no route in any more',
  );

  const nurse = applyPartyConfirmation(session, 'department', { name: 'Nurse', employeeId: 'N1' }, '2026-07-30T10:00:00.000Z');
  assert.equal(nurse.complete, true, 'the nurse alone completes it');
  assert.equal(nurse.session.status, 'completed');
  assert.equal(nurse.session.pharmacyConfirmation.name, 'Pharmacist');
  assert.equal(nurse.session.departmentConfirmation.employeeId, 'N1');
});

test('a handover created before the change still completes both ways', () => {
  // Sessions issued under the two-code flow keep working until they expire.
  const legacy = {
    id: 's0', status: 'waiting_both_confirmations',
    pharmacyTokenHash: 'hash-p', departmentTokenHash: 'hash-d',
    pharmacyConfirmation: null, departmentConfirmation: null,
  };
  const first = applyPartyConfirmation(legacy, 'pharmacy', { name: 'Pharmacist', employeeId: 'P1' }, '2026-07-30T09:55:00.000Z');
  assert.equal(first.complete, false);
  assert.equal(first.session.status, 'pharmacy_confirmed');

  const repeated = applyPartyConfirmation(first.session, 'pharmacy', { name: 'Other', employeeId: 'P2' }, '2026-07-30T09:56:00.000Z');
  assert.equal(repeated.alreadyConfirmed, true);
  assert.equal(repeated.session.pharmacyConfirmation.employeeId, 'P1', 'a confirmation cannot be overwritten');

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
  // Only the department scans now, so a new receipt says 'temporary_qr'; the
  // older 'temporary_dual_qr' value stays readable on receipts already issued.
  assert.equal(state.receipts[0].confirmationMethod, 'temporary_qr');
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
