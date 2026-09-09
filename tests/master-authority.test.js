import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  resolveMasterFlag,
  masterClaimIsStale,
  claimsCarryRole,
} from '../public/assets/js/core/master-authority.js';

/* "Is this user Master" was answered from two different places: the browser read
   it off the users document, firestore.rules read it off the token claim. Claims
   are written by a Cloud Function and can lag a document edit — and when they
   did, the account got the full Master interface and had every write refused.
   Buttons present, database saying no, which reads as a broken app rather than a
   missing permission. */

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

test('the client decides exactly as firestore.rules decides', () => {
  // rules: token has a role claim ? token.master == true : profile.master == true
  const rule = /function masterClaim\(\) \{\s*return request\.auth\.token\.get\('role', null\) != null\s*\? request\.auth\.token\.get\('master', false\) == true\s*: \(hasProfile\(\) && profile\(\)\.get\('master', false\) == true\)/;
  assert.match(rules, rule, 'firestore.rules changed shape — the client rule must follow it');

  // Claims present and true: Master, whatever the document says.
  assert.equal(resolveMasterFlag({ role: 'pharmacy', master: true }, { master: false }), true);
  // Claims present and false: NOT Master, even though the document promises it.
  assert.equal(resolveMasterFlag({ role: 'pharmacy', master: false }, { master: true }), false);
  // Claims present without a master field at all: not Master.
  assert.equal(resolveMasterFlag({ role: 'pharmacy' }, { master: true }), false);
  // No claims written yet: the document is the fallback, as in the rules.
  assert.equal(resolveMasterFlag(null, { master: true }), true);
  assert.equal(resolveMasterFlag({}, { master: true }), true);
  assert.equal(resolveMasterFlag(undefined, { master: false }), false);
  assert.equal(resolveMasterFlag(null, null), false);
});

test('a role claim is what marks the claims as written', () => {
  assert.equal(claimsCarryRole({ role: 'department' }), true);
  assert.equal(claimsCarryRole({ role: null }), false);
  assert.equal(claimsCarryRole({}), false);
  assert.equal(claimsCarryRole(null), false);
});

test('a document promising Master over a claim that does not is reported, not hidden', () => {
  assert.equal(masterClaimIsStale({ role: 'pharmacy', master: false }, { master: true }), true);
  // Not stale when the document never claimed Master, or the claim agrees.
  assert.equal(masterClaimIsStale({ role: 'pharmacy', master: false }, { master: false }), false);
  assert.equal(masterClaimIsStale({ role: 'pharmacy', master: true }, { master: true }), false);
  // Nor before claims exist at all — that is the documented fallback, not a lag.
  assert.equal(masterClaimIsStale(null, { master: true }), false);
});

test('login takes the flag from the token and says so when it lags', async () => {
  const login = await readFile(new URL('../public/assets/js/modules/03f-app-shell-nav-dashboard-inventory.js', import.meta.url), 'utf8');
  assert.match(login, /masterAuthority=await resolveMasterFromUser\(credential\.user,profile\)/);
  assert.match(login, /master:masterAuthority\.master===true/);
  assert.ok(!/master:profile\.master===true,username/.test(login), 'the document is no longer the authority');
  assert.match(login, /permissions have not finished syncing/);
});

test('a lagging claim does not sign the account out in a loop', async () => {
  /* The self-profile watch signs out when permissions change, by comparing the
     document to CU.master. Now that CU.master is the claim, that comparison
     would fire on every snapshot for exactly the account this fix is about. */
  const stateModule = await readFile(new URL('../public/assets/js/modules/03-core-application-firebase-state-auth.js', import.meta.url), 'utf8');
  assert.match(stateModule, /window\.CU\.documentMaster!==undefined\?window\.CU\.documentMaster:window\.CU\.master/);
  const login = await readFile(new URL('../public/assets/js/modules/03f-app-shell-nav-dashboard-inventory.js', import.meta.url), 'utf8');
  assert.match(login, /documentMaster:profile\.master===true/);
});
