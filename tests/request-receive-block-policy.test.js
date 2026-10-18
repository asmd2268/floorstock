import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  deriveReceiveBlock, applyBlockMode, normalizeBlockSettings, summarizeDepartmentBlocks, isAwaitingReceipt,
} from '../public/assets/js/core/request-receive-block-policy.js';
import { deriveNewRequestGateState } from '../public/assets/js/core/new-request-gate-policy.js';
import { hasCapability, canAccessPage, canWriteStateKey } from '../public/assets/js/core/role-capabilities.js';

const fulfilled = (id, dept, at, over = {}) => ({
  id, deptId: dept, status: 'fulfilled', fulfilledAt: at, dispensed: [{ medId: 'm1', qty: 5 }], ...over,
});

test('a department that has not received its last order is blocked automatically, in both languages', () => {
  const state = deriveReceiveBlock({ requests: [fulfilled('r1', 'd1', '2026-10-01T08:00:00Z')], departmentId: 'd1' });
  assert.equal(state.blocked, true);
  assert.equal(state.source, 'auto');
  assert.match(state.reasonAr, /استلام/);
  assert.match(state.reasonEn, /received/);
});

test('receiving the last order lifts the automatic block', () => {
  const state = deriveReceiveBlock({
    requests: [fulfilled('r1', 'd1', '2026-10-01T08:00:00Z', { receivedAt: '2026-10-02T08:00:00Z' })],
    departmentId: 'd1',
  });
  assert.equal(state.blocked, false);
});

test('only the LAST order counts, and another department never does', () => {
  const requests = [
    fulfilled('old', 'd1', '2026-09-01T08:00:00Z'),
    fulfilled('new', 'd1', '2026-10-01T08:00:00Z', { receivedAt: '2026-10-02T08:00:00Z' }),
    fulfilled('other', 'd2', '2026-10-05T08:00:00Z'),
  ];
  assert.equal(deriveReceiveBlock({ requests, departmentId: 'd1' }).blocked, false);
  assert.equal(deriveReceiveBlock({ requests, departmentId: 'd2' }).blocked, true);
});

test('an order where nothing was dispensed has nothing to receive', () => {
  assert.equal(isAwaitingReceipt(fulfilled('r', 'd1', '2026-10-01T08:00:00Z', { dispensed: [{ medId: 'm', qty: 0 }] })), false);
  assert.equal(isAwaitingReceipt({ status: 'pending' }), false);
});

test('allow is an exception for one department only', () => {
  const requests = [fulfilled('r1', 'd1', '2026-10-01T08:00:00Z'), fulfilled('r2', 'd2', '2026-10-01T08:00:00Z')];
  const settings = applyBlockMode({}, 'd1', 'allow', { name: 'Director', id: 'u1' }, '2026-10-18T10:00:00Z');
  assert.equal(deriveReceiveBlock({ requests, departmentId: 'd1', settings }).blocked, false);
  assert.equal(deriveReceiveBlock({ requests, departmentId: 'd2', settings }).blocked, true);
});

test('block stops a department that has received everything, with a bilingual reason', () => {
  const settings = applyBlockMode({}, 'd1', 'block', {}, '2026-10-18T10:00:00Z');
  const state = deriveReceiveBlock({ requests: [], departmentId: 'd1', settings });
  assert.equal(state.blocked, true);
  assert.equal(state.source, 'manual');
  assert.match(state.reasonAr, /[؀-ۿ]/);
  assert.match(state.reasonEn, /blocked/);
});

test('auto removes the entry, and who changed it is recorded', () => {
  let settings = applyBlockMode({}, 'd1', 'block', { name: 'Sad', id: 'u9' }, '2026-10-18T10:00:00Z');
  assert.deepEqual(settings.d1, { mode: 'block', updatedAt: '2026-10-18T10:00:00Z', updatedBy: 'Sad', updatedById: 'u9' });
  settings = applyBlockMode(settings, 'd1', 'auto');
  assert.deepEqual(settings, {});
});

test('malformed settings are ignored rather than trusted', () => {
  assert.deepEqual(normalizeBlockSettings(null), {});
  assert.deepEqual(normalizeBlockSettings([]), {});
  assert.deepEqual(normalizeBlockSettings({ d1: 'nonsense', d2: { mode: 'BLOCK' } }), {
    d2: { mode: 'block', updatedAt: '', updatedBy: '', updatedById: '' },
  });
});

test('the new-request gate reports the receive block even while the ordering window is closed', () => {
  const gate = deriveNewRequestGateState({
    isDepartment: true,
    departmentId: 'd1',
    requests: [fulfilled('r1', 'd1', '2026-10-01T08:00:00Z')],
    schedule: { allowed: false },
  });
  assert.equal(gate.blocked, true);
  assert.equal(gate.kind, 'receive-block');
  assert.ok(gate.reasonAr && gate.reasonEn);
});

test('a department with nothing wrong is not blocked by the new rule', () => {
  const gate = deriveNewRequestGateState({ isDepartment: true, departmentId: 'd1', requests: [], schedule: { allowed: true } });
  assert.equal(gate.blocked, false);
});

test('the management summary covers every department', () => {
  const rows = summarizeDepartmentBlocks({
    departments: [{ id: 'd1', name: 'ICU' }, { id: 'd2', name: 'ER' }],
    requests: [fulfilled('r1', 'd1', '2026-10-01T08:00:00Z')],
    settings: applyBlockMode({}, 'd2', 'block'),
  });
  assert.deepEqual(rows.map((r) => [r.name, r.blocked, r.source]), [['ICU', true, 'auto'], ['ER', true, 'manual']]);
});

test('Master, Pharmacy Director and the Inpatient Pharmacy Supervisor may manage blocks — nobody else', () => {
  assert.equal(hasCapability({ role: 'pharmacy' }, 'requestBlocks.manage'), true);
  assert.equal(hasCapability({ role: 'inpatient_supervisor' }, 'requestBlocks.manage'), true);
  assert.equal(hasCapability({ role: 'department', master: true }, 'requestBlocks.manage'), true);
  for (const role of ['pharmacy_staff', 'outpatient_pharmacy_supervisor', 'department', 'controlled_pharmacy', 'warehouse']) {
    assert.equal(hasCapability({ role }, 'requestBlocks.manage'), false, role);
    assert.equal(canAccessPage({ role }, 'pg-request-blocks'), false, role);
  }
  assert.equal(canAccessPage({ role: 'inpatient_supervisor' }, 'pg-request-blocks'), true);
  assert.equal(canWriteStateKey({ role: 'inpatient_supervisor' }, 'request_receive_blocks_v1'), true);
  assert.equal(canWriteStateKey({ role: 'department', deptId: 'd1' }, 'request_receive_blocks_v1'), false);
  assert.equal(canWriteStateKey({ role: 'pharmacy_staff' }, 'request_receive_blocks_v1'), false);
});
