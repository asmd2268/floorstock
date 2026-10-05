import assert from 'node:assert/strict';
import { test } from 'node:test';

import { crashCartSealInfo, crashCartSealLabel } from '../public/assets/js/core/crash-cart-seal-info.js';

const closed = { newSeal: 'R100273', closedAt: '2026-09-30T08:00:00.000Z' };

test('the cart seal that matches the last closure is a closure seal', () => {
  assert.deepEqual(crashCartSealInfo({ seal: 'r100273' }, closed), { source: 'closure', seal: 'r100273' });
});

test('a Master correction after the closure is reported as such, not as the closure seal', () => {
  const info = crashCartSealInfo({
    seal: 'G065492', lastSealCorrectionAt: '2026-10-02T10:00:00.000Z',
    lastSealCorrectionBy: 'Ali', lastSealCorrectionReason: 'wrong seal typed'
  }, closed);
  assert.equal(info.source, 'master_correction');
  assert.equal(info.seal, 'G065492');
  const label = crashCartSealLabel(info, (v) => '02/10/2026', (v) => v);
  assert.match(label, /G065492/);
  assert.match(label, /Master correction/);
  assert.doesNotMatch(label, /R100273/);
});

test('a differing seal with no decision shows BOTH numbers', () => {
  const info = crashCartSealInfo({ seal: 'G065492' }, closed);
  assert.equal(info.source, 'mismatch');
  assert.equal(info.closureSeal, 'R100273');
  const label = crashCartSealLabel(info, (v) => v, (v) => v);
  assert.match(label, /G065492/);
  assert.match(label, /R100273/);
});

test('the Master confirming the cart seal settles the difference', () => {
  const cart = { seal: 'G065492', sealConfirmedSeal: 'g065492', sealConfirmedAt: '2026-10-05T10:00:00.000Z', sealConfirmedBy: 'Ali' };
  const info = crashCartSealInfo(cart, closed);
  assert.equal(info.source, 'master_confirmed');
  assert.match(crashCartSealLabel(info, (v) => v, (v) => v), /confirmed by Master/);
});

test('a confirmation does not carry over to a different seal', () => {
  const cart = { seal: 'X999', sealConfirmedSeal: 'G065492', sealConfirmedAt: '2026-10-05T10:00:00.000Z' };
  assert.equal(crashCartSealInfo(cart, closed).source, 'mismatch');
});

test('a correction that put the closure seal back leaves nothing to explain', () => {
  const info = crashCartSealInfo({ seal: 'R100273', lastSealCorrectionAt: '2026-10-03T10:00:00.000Z' }, closed);
  assert.equal(info.source, 'closure');
});

test('a correction older than the closure does not explain a later difference', () => {
  const info = crashCartSealInfo({ seal: 'G065492', lastSealCorrectionAt: '2026-09-01T10:00:00.000Z' }, closed);
  assert.equal(info.source, 'mismatch');
});

test('no closing report: the cart seal stands alone', () => {
  assert.deepEqual(crashCartSealInfo({ seal: 'G1' }, null), { source: 'cart', seal: 'G1' });
  assert.deepEqual(crashCartSealInfo({}, null), { source: 'none', seal: '' });
});

test('the label escapes what it is given', () => {
  const info = { source: 'master_correction', seal: '<b>', correctedAt: 'x', correctedBy: '' };
  const label = crashCartSealLabel(info, (v) => v, (v) => String(v).replace(/</g, '&lt;'));
  assert.ok(!label.includes('<b>'));
});

import { findSealConflict } from '../public/assets/js/core/crash-cart-seal-info.js';

const carts = [
  { id: 'c1', name: 'ER Cart', seal: 'G065492' },
  { id: 'c2', name: 'ICU Cart', seal: 'R200001' }
];

test('restoring a cart to its own last closure seal is allowed even when a later report of the same cart mentions it', () => {
  const reports = [
    { cartId: 'c1', status: 'closed', oldSeal: 'A1', newSeal: 'R100273', closedAt: '2026-09-30T08:00:00.000Z' },
    // later: accepted without fitting a new seal, so it still names the seal it found
    { cartId: 'c1', status: 'accepted', oldSeal: 'R100273', newSeal: '', createdAt: '2026-10-02T08:00:00.000Z' }
  ];
  assert.equal(findSealConflict('r100273', 'c1', carts, reports), null);
});

test('another cart\'s current seal and another cart\'s history still block, and say where', () => {
  const reports = [{ cartId: 'c2', status: 'closed', oldSeal: 'X9', newSeal: 'R100273', closedAt: '2026-09-01T00:00:00.000Z' }];
  const hit = findSealConflict('R100273', 'c1', carts, reports);
  assert.equal(hit.where, 'seal-history');
  assert.equal(hit.cart, 'ICU Cart');
  assert.equal(findSealConflict('R200001', 'c1', carts, []).where, 'another-cart');
});

test('a number from this cart\'s OLDER history is still blocked — only the latest closure seal may be restored', () => {
  const reports = [
    { cartId: 'c1', status: 'closed', oldSeal: 'A0', newSeal: 'OLD111', closedAt: '2026-08-01T00:00:00.000Z' },
    { cartId: 'c1', status: 'closed', oldSeal: 'OLD111', newSeal: 'R100273', closedAt: '2026-09-30T08:00:00.000Z' }
  ];
  assert.equal(findSealConflict('OLD111', 'c1', carts, reports).where, 'seal-history');
  assert.equal(findSealConflict('R100273', 'c1', carts, reports), null);
});

test('a blank seal is never a conflict', () => {
  assert.equal(findSealConflict('  ', 'c1', carts, [{ cartId: 'c2', oldSeal: '', newSeal: '' }]), null);
});
