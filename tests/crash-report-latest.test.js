import test from 'node:test';
import assert from 'node:assert/strict';
import { latestClosedByCart } from '../public/assets/js/core/crash-report-latest.js';

const legacy = (rows, cartId) => rows
  .filter((r) => String(r.cartId) === String(cartId) && r.status === 'closed')
  .sort((a, b) => String(b.closedAt || b.lastEditedAt || '').localeCompare(String(a.closedAt || a.lastEditedAt || '')))[0] || null;

test('latest closed report per cart matches the old per-cart sort', () => {
  const rows = [
    { id: 'a', cartId: 1, status: 'closed', closedAt: '2026-01-01' },
    { id: 'b', cartId: 1, status: 'closed', closedAt: '2026-03-01' },
    { id: 'c', cartId: 1, status: 'open', closedAt: '2026-09-01' },
    { id: 'd', cartId: 2, status: 'closed', lastEditedAt: '2026-02-01' },
    { id: 'e', cartId: 2, status: 'closed', closedAt: '2026-02-01' },
    { id: 'f', cartId: 3, status: 'open' },
    null,
  ];
  const map = latestClosedByCart(rows);
  [1, 2, 3, 4, '1'].forEach((id) => assert.equal(map.get(id), legacy(rows.filter(Boolean), id)));
  assert.equal(map.get(1).id, 'b');
  assert.equal(map.get(3), null);
});
