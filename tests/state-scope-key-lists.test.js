import test from 'node:test';
import assert from 'node:assert/strict';
import { recentAuditLogKeys, controlledPharmacyDeptKeys, pharmacyDepartmentStateKeys } from '../public/assets/js/core/state-scope-key-lists.js';

test('audit months run from the current month backwards and cross a year boundary', () => {
  const now = new Date(Date.UTC(2026, 0, 15));
  assert.deepEqual(recentAuditLogKeys(1, now), ['audit_log_2026-01', 'audit_log_2025-12']);
  assert.deepEqual(recentAuditLogKeys(0, now), ['audit_log_2026-01', 'audit_log_2025-12']);
  assert.equal(recentAuditLogKeys(3, now).length, 4);
});

test('controlled pharmacy asks for list, settings and shelves of every department', () => {
  const cache = { departments: [{ id: 'd1' }, { id: ' d2 ' }, { id: '' }, null, {}] };
  assert.deepEqual(controlledPharmacyDeptKeys(cache), [
    'controlled_dept_list_d1', 'controlled_settings_d1', 'controlled_dept_shelves_d1',
    'controlled_dept_list_d2', 'controlled_settings_d2', 'controlled_dept_shelves_d2',
  ]);
  assert.deepEqual(controlledPharmacyDeptKeys({}), []);
  assert.deepEqual(controlledPharmacyDeptKeys(null), []);
});

test('pharmacy roles read the six per-department keys for each department', () => {
  const keys = pharmacyDepartmentStateKeys({ departments: [{ id: 'icu' }, { id: 'er' }] });
  assert.equal(keys.length, 12);
  ['meds_icu', 'expiry_icu', 'shelves_icu', 'alerts_icu', 'inventory_integrity_icu', 'inventory_snapshot_index_icu', 'meds_er'].forEach((key) => assert.ok(keys.includes(key), key));
  assert.deepEqual(pharmacyDepartmentStateKeys(undefined), []);
});
