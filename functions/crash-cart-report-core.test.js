'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { applyCrashCartReport, publicCrashCartPayload } = require('./crash-cart-report-core');

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

test('department report changes only its assigned cart and creates an open report', () => {
  const source = fixture();
  const result = applyCrashCartReport({
    ...source,
    cartId: 'cart-a', departmentId: 'dept-a', reason: 'Code Blue',
    oldSeal: 'OLD-123',
    consumed: [{ itemId: 'med-a', qty: 2, reportedExpiry: '2027-01-01' }],
    actorName: 'Department Employee', stamp: '2026-08-04T07:00:00.000Z',
  });
  assert.equal(result.cart.items[0].present, 3);
  assert.equal(result.cart.items[0].batches[0].qty, 1);
  assert.equal(result.report.status, 'open');
  assert.equal(result.report.inventoryDeductedAtReport, true);
  assert.equal(result.report.oldSeal, 'OLD-123');
  assert.deepEqual(result.carts[1], source.carts[1]);
});

test('editing an open report restores its earlier deduction before applying the replacement report', () => {
  const first = applyCrashCartReport({
    ...fixture(), cartId: 'cart-a', departmentId: 'dept-a', reason: 'Code Blue',
    consumed: [{ itemId: 'med-a', qty: 2, reportedExpiry: '2027-01-01' }],
    actorName: 'Employee', stamp: '2026-08-04T07:00:00.000Z',
  });
  const second = applyCrashCartReport({
    carts: first.carts, reports: first.reports, cartId: 'cart-a', departmentId: 'dept-a', reason: 'Code Blue',
    consumed: [{ itemId: 'med-a', qty: 1, reportedExpiry: '2027-06-01' }],
    actorName: 'Employee', stamp: '2026-08-04T07:05:00.000Z',
  });
  assert.equal(second.cart.items[0].present, 4);
  assert.equal(second.cart.items[0].batches.find((batch) => batch.batchId === 'batch-a').qty, 3);
  assert.equal(second.cart.items[0].batches.find((batch) => batch.batchId === 'batch-b').qty, 1);
  assert.equal(second.reports.length, 1);
  assert.equal(second.report.id, first.report.id);
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
