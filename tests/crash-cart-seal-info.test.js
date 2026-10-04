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
