'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { applyCrashCartReport, acceptCrashCartReport, publicCrashCartPayload } = require('./crash-cart-report-core');

function fixture() {
  return {
    carts: [
      {
        id: 'cart-a', deptId: 'dept-a', name: 'Cart A', seal: 'SECRET-SEAL',
        items: [{ id: 'med-a', name: 'Medicine A', qty: 5, present: 5, batches: [
          { batchId: 'batch-a', expiry: '2027-01-01', qty: 3, lot: 'L1' },
          { batchId: 'batch-b', expiry: '2027-06-01', qty: 2, lot: 'L2' },
        ] }],
      },
      { id: 'cart-b', deptId: 'dept-b', name: 'Cart B', items: [] },
    ],
    reports: [],
  };
}

test('department report changes only its assigned cart and creates a pending report without deducting inventory', () => {
  const source = fixture();
  const result = applyCrashCartReport({
    ...source,
    cartId: 'cart-a', departmentId: 'dept-a', reason: 'Code Blue',
    oldSeal: 'SECRET-SEAL',
    consumed: [{ itemId: 'med-a', qty: 2, reportedExpiry: '2027-01-01' }],
    actorName: 'Department Employee', stamp: '2026-08-04T07:00:00.000Z',
  });
  // Phase 7a: submit creates a pending report — deduction happens only when pharmacy accepts.
  assert.equal(result.cart.items[0].present, 5);
  assert.equal(result.cart.items[0].batches[0].qty, 3);
  assert.equal(result.report.status, 'pending');
  assert.equal(result.report.inventoryDeductedAtReport, false);
  assert.equal(result.report.oldSeal, 'SECRET-SEAL');
  assert.deepEqual(result.carts[1], source.carts[1]);
});

test('accepting a pending report deducts inventory from the correct batches', () => {
  const submitted = applyCrashCartReport({
    ...fixture(), cartId: 'cart-a', departmentId: 'dept-a', reason: 'Code Blue',
    oldSeal: 'SECRET-SEAL',
    consumed: [{ itemId: 'med-a', qty: 2, reportedExpiry: '2027-01-01' }],
    actorName: 'Employee', stamp: '2026-08-04T07:00:00.000Z',
  });
  const accepted = acceptCrashCartReport({
    carts: submitted.carts, reports: submitted.reports, reportId: submitted.report.id,
    actorName: 'Pharmacy', stamp: '2026-08-04T08:00:00.000Z',
  });
  assert.equal(accepted.cart.items[0].present, 3);
  assert.equal(accepted.cart.items[0].batches.find((batch) => batch.batchId === 'batch-a').qty, 1);
  assert.equal(accepted.report.status, 'accepted');
  assert.equal(accepted.report.inventoryDeductedAtReport, true);
});

test('re-submitting a pending report replaces it without needing a restore (nothing was deducted)', () => {
  const first = applyCrashCartReport({
    ...fixture(), cartId: 'cart-a', departmentId: 'dept-a', reason: 'Code Blue',
    oldSeal: 'SECRET-SEAL',
    consumed: [{ itemId: 'med-a', qty: 2, reportedExpiry: '2027-01-01' }],
    actorName: 'Employee', stamp: '2026-08-04T07:00:00.000Z',
  });
  const second = applyCrashCartReport({
    carts: first.carts, reports: first.reports, cartId: 'cart-a', departmentId: 'dept-a', reason: 'Code Blue',
    oldSeal: 'SECRET-SEAL',
    consumed: [{ itemId: 'med-a', qty: 1, reportedExpiry: '2027-06-01' }],
    actorName: 'Employee', stamp: '2026-08-04T07:05:00.000Z',
  });
  assert.equal(second.cart.items[0].present, 5);
  assert.equal(second.cart.items[0].batches.find((batch) => batch.batchId === 'batch-a').qty, 3);
  assert.equal(second.cart.items[0].batches.find((batch) => batch.batchId === 'batch-b').qty, 2);
  assert.equal(second.reports.length, 1);
  assert.equal(second.report.id, first.report.id);
  assert.equal(second.report.status, 'pending');
});

test('department cannot report another department Crash Cart', () => {
  assert.throws(() => applyCrashCartReport({
    ...fixture(), cartId: 'cart-b', departmentId: 'dept-a', reason: 'Code Blue',
    consumed: [{ itemId: 'med-a', qty: 1 }], actorName: 'Employee',
  }), /not assigned/);
});

test('public QR payload omits seals and staff identities', () => {
  const cart = fixture().carts[0];
  cart.updatedBy = 'Employee Name';
  const payload = publicCrashCartPayload(cart);
  const text = JSON.stringify(payload);
  assert.equal(payload.scope, 'crash_cart');
  assert.equal(payload.items[0].present, 5);
  assert.doesNotMatch(text, /SECRET-SEAL|Employee Name/);
});
