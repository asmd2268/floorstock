import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  stateKeysForProfile, isPharmacyScopedProfile, uniqueKeys, departmentKeysFor,
} from '../public/assets/js/core/state-read-scope.js';

/* Which state documents a role reads at sign-in. A key missing here is a blank
   screen with no error; a key the role may not read is a permission error on
   every login. It was checked only by matching strings in the source. */

const lists = {
  pharmacyScoped: ['requests', 'departments'],
  controlledPharmacyBase: ['controlled_catalog', 'departments'],
  warehouse: ['controlled_warehouse', 'departments'],
  departmentShared: ['departments', 'requests'],
  auditKeys: (months) => ['audit_log_2026-03'].slice(0, months + 1),
  ledgerKeys: (months) => ['controlled_moves', `controlled_moves_h1447-${String(months).padStart(2, '0')}`],
  ledgerMonths: 12,
};
const keysFor = (profile) => stateKeysForProfile(profile, lists);

test('only the Master reads the whole collection', () => {
  /* null means "list it" — and the Master is the only profile the rules let
     list it. */
  assert.equal(keysFor({ master: true, role: 'pharmacy' }), null);
  assert.equal(keysFor({ role: 'pharmacy' }), null, 'an unscoped role is not limited by this list');
  assert.equal(keysFor(null), null);
});

test('the scoped pharmacy roles are named exactly, including the spaced spelling', () => {
  for (const role of ['inpatient_supervisor', 'inpatient_pharmacy_supervisor', 'inpatient pharmacy supervisor', 'pharmacy_staff']) {
    assert.equal(isPharmacyScopedProfile({ role }), true, role);
    assert.ok(keysFor({ role }).includes('requests'), role);
  }
  assert.equal(isPharmacyScopedProfile({ role: 'department' }), false);
  assert.equal(isPharmacyScopedProfile(null), false);
});

test('every scoped role gets the month-partitioned keys as well as its own list', () => {
  for (const profile of [{ role: 'pharmacy_staff' }, { role: 'controlled_pharmacy' }, { role: 'warehouse' }, { role: 'department', deptId: 'icu' }]) {
    const keys = keysFor(profile);
    assert.ok(keys.includes('controlled_moves'), `${profile.role} reads the legacy document`);
    assert.ok(keys.some((key) => key.startsWith('controlled_moves_h')), `${profile.role} reads the month partitions`);
  }
});

test('a key named twice is read once — a duplicate is a paid read for nothing', () => {
  const keys = keysFor({ role: 'department', deptId: 'icu' });
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(uniqueKeys(['a', 'b', 'a', 'b', 'c']), ['a', 'b', 'c']);
  assert.deepEqual(uniqueKeys(null), []);
});

test('a department reads its own inventory, and nobody else\'s', () => {
  const keys = keysFor({ role: 'department', deptId: 'icu' });
  for (const prefix of ['meds_', 'expiry_', 'shelves_', 'alerts_', 'inventory_integrity_', 'inventory_snapshot_index_']) {
    assert.ok(keys.includes(prefix + 'icu'), prefix);
  }
  assert.equal(keys.some((key) => key.endsWith('_er')), false);
});

test('every department reads its own controlled list and its print signatures', () => {
  /* The signatures are not a custodian privilege: gating them behind that flag
     left the signature lines blank on other departments' custody printouts. */
  const plain = keysFor({ role: 'department', deptId: 'icu' });
  assert.ok(plain.includes('controlled_dept_list_icu'));
  assert.ok(plain.includes('controlled_settings_icu'));
  assert.equal(plain.includes('controlled_dept_shelves_icu'), false, 'but the shelf configuration is the custodian\'s');

  const custodian = keysFor({ role: 'department', deptId: 'icu', controlledCustodian: true });
  assert.ok(custodian.includes('controlled_dept_shelves_icu'));
});

test('a department account with no department reads only the shared documents', () => {
  const keys = keysFor({ role: 'department' });
  assert.equal(keys.some((key) => key.startsWith('meds_')), false, 'never "meds_undefined"');
  assert.ok(keys.includes('departments'));
  assert.deepEqual(departmentKeysFor({ deptId: '   ' }), []);
});

test('the outpatient supervisor is scoped like a department', () => {
  const keys = keysFor({ role: 'outpatient_pharmacy_supervisor', deptId: 'opd' });
  assert.ok(keys.includes('meds_opd'));
  assert.ok(keys.includes('requests'));
});

test('only the roles that need an audit month load one', () => {
  assert.ok(keysFor({ role: 'controlled_pharmacy' }).includes('audit_log_2026-03'));
  assert.ok(keysFor({ role: 'warehouse' }).includes('audit_log_2026-03'));
  assert.equal(keysFor({ role: 'pharmacy_staff' }).includes('audit_log_2026-03'), false);
  assert.equal(keysFor({ role: 'department', deptId: 'icu' }).includes('audit_log_2026-03'), false);
});

test('the department id is taken from either field it has been stored under', () => {
  assert.ok(keysFor({ role: 'department', departmentId: 'er' }).includes('meds_er'));
  assert.ok(keysFor({ role: 'department', deptId: 'er' }).includes('meds_er'));
});
