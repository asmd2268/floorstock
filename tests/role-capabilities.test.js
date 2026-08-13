import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessDepartment, hasCapability, normalizeRole } from '../public/assets/js/core/role-capabilities.js';

test('role aliases normalize without widening privileges', () => {
  assert.equal(normalizeRole('external pharmacy supervisor'), 'outpatient_pharmacy_supervisor');
  assert.equal(normalizeRole('inpatient pharmacy supervisor'), 'inpatient_supervisor');
  assert.equal(hasCapability({ role: 'external pharmacy supervisor' }, 'crashCart.operate'), true);
  assert.equal(hasCapability({ role: 'external pharmacy supervisor' }, 'inventory.manage'), false);
});

test('department scope is exact and outpatient supervisor is single-department only', () => {
  const outpatient = { role: 'outpatient_pharmacy_supervisor', deptId: 'outpatient' };
  // inpatient_supervisor sees ALL departments including outpatient (R6.76.52 policy change)
  const inpatient = { role: 'inpatient_supervisor', deptId: 'male-medical' };
  const employee = { role: 'department', deptId: 'anesthesia' };
  assert.equal(canAccessDepartment(outpatient, 'outpatient'), true);
  assert.equal(canAccessDepartment(outpatient, 'male-medical'), false);
  assert.equal(canAccessDepartment(inpatient, 'male-medical'), true);
  assert.equal(canAccessDepartment(inpatient, 'outpatient'), true);
  assert.equal(canAccessDepartment(employee, 'anesthesia'), true);
  assert.equal(canAccessDepartment(employee, 'emergency'), false);
});

test('master bypass is explicit while forged master flag is not enough without the profile boundary', () => {
  assert.equal(hasCapability({ role: 'department', master: true }, 'users.manage'), true);
  assert.equal(hasCapability({ role: 'department', master: false }, 'users.manage'), false);
});
