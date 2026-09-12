'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildUserClaims } = require('./sync-user-claims.js');

/* firestore.rules branches on these claims: activeUser() is
   request.auth.token.get('active', false) == true whenever a role claim
   exists. So a profile the rest of the system treats as active MUST claim
   active:true, or every state read is denied and the session is locked out. */

test('a profile with no active field is active — the whole codebase says "unless explicitly false"', () => {
  assert.equal(buildUserClaims({ role: 'department', deptId: 'fmw' }).active, true);
});

test('only an explicit false deactivates', () => {
  assert.equal(buildUserClaims({ role: 'department', active: false }).active, false);
  assert.equal(buildUserClaims({ role: 'department', active: true }).active, true);
});

test('department identity survives either field spelling', () => {
  assert.equal(buildUserClaims({ departmentId: 'fmw' }).deptId, 'fmw');
  assert.equal(buildUserClaims({ deptId: 'fmw' }).deptId, 'fmw');
});

test('master and tenant are unchanged, and absent values never become undefined', () => {
  const claims = buildUserClaims({});
  assert.deepEqual(claims, { role: '', deptId: '', active: true, master: false, tenantId: '' });
  assert.equal(buildUserClaims({ master: true }).master, true);
  assert.equal(buildUserClaims({ master: 'yes' }).master, false);
});
