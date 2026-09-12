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

test('outpatient supervisor reaches the outpatient department by name when their profile carries no deptId', () => {
  /* The regression: fsOutpatientDeptId() resolves the department by NAME and
     returns its real id, but canAccessDepartment only accepted the literal ids.
     A supervisor with no deptId passed the caller's filter and was rejected
     here, so every request/note/cart disappeared for them. */
  const previous = globalThis.S;
  globalThis.S = { g: (key) => (key === 'departments'
    ? [{ id: 'dept_7', name: 'Outpatient Department' }, { id: 'dept_3', name: 'Male Medical' }]
    : null) };
  try {
    const supervisor = { role: 'outpatient_pharmacy_supervisor' }; // no deptId on the profile
    assert.equal(canAccessDepartment(supervisor, 'dept_7'), true);
    assert.equal(canAccessDepartment(supervisor, 'dept_3'), false);
    // the literal ids keep working for tenants that use them
    assert.equal(canAccessDepartment(supervisor, 'outpatient'), true);
    // and a supervisor who DOES carry a deptId is still scoped to exactly it
    const scoped = { role: 'outpatient_pharmacy_supervisor', deptId: 'dept_3' };
    assert.equal(canAccessDepartment(scoped, 'dept_3'), true);
  } finally { globalThis.S = previous; }
});
