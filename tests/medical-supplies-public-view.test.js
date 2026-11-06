import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicPageHtml } from '../public/assets/js/core/medical-supplies-public-view.js';

const snap = { deptId: 'icu', departmentName: 'ICU', alerts: { d1: 30, d2: 7 }, cabinets: [{ id: 'c1', name: 'Cab 1' }, { id: 'c2', name: 'Cab 2' }],
  items: [
    { name: 'Later', code: 'L', group: '', cabinetIds: ['c1'], outOfStock: false, batches: [{ batch: '', expiry: '2027-06-01', qty: null }] },
    { name: 'Soon <b>', code: 'S', group: 'Inj', cabinetIds: ['c1', 'c2'], outOfStock: false, batches: [{ batch: 'B1', expiry: '2026-11-08', qty: 4 }] },
    { name: 'Other', code: 'O', group: '', cabinetIds: ['c2'], outOfStock: true, batches: [] },
  ] };
const today = new Date(2026, 10, 5);

test('the public page lists the soonest expiry first, marks warnings and escapes names', () => {
  const html = publicPageHtml(snap, { today, updatedLabel: 'now' });
  assert.ok(html.indexOf('Soon &lt;b&gt;') < html.indexOf('Later'));
  assert.ok(html.includes('⚠'));
  assert.ok(html.includes('By Ali Abudahash'));
  assert.equal(html.includes('Soon <b>'), false);
});

test('a cabinet QR shows only that cabinet', () => {
  const html = publicPageHtml(snap, { cabinetId: 'c2', today, updatedLabel: 'now' });
  assert.ok(html.includes('Cab 2') && html.includes('Other') && html.includes('Soon'));
  assert.equal(html.includes('Later'), false);
});

test('an empty list says so instead of showing a blank table', () => {
  assert.ok(publicPageHtml({ deptId: 'x', items: [], cabinets: [] }, { today, updatedLabel: '-' }).includes('Nothing is published'));
});
