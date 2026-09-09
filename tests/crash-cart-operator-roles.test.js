import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createRequire } from 'node:module';

import { hasCapability } from '../public/assets/js/core/role-capabilities.js';

const require = createRequire(import.meta.url);
const AUTHORITY = require('../functions/crash-cart-operator-roles.json').roles;

/* Who may answer a Crash Cart report is needed in three places that cannot
   import one another: the browser's capability table (ES modules),
   firestore.rules (its own language), and the Cloud Functions (CommonJS).

   They had drifted twice over. The rules allowed only pharmacyDirector, so a
   pharmacy staff member could fill in a response and be refused on save —
   reported from the floor as "missing or insufficient permissions". And the
   functions' own list still omitted the outpatient supervisor, who would have
   been refused the moment the close moved server-side. */

test('firestore.rules lists exactly the authoritative roles', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  const block = /function crashCartOperator\(\) \{[\s\S]*?role\(\) in \[([\s\S]*?)\]/.exec(rules);
  assert.ok(block, 'crashCartOperator() was not found in firestore.rules');
  const inRules = block[1].split(',').map((entry) => entry.trim().replace(/^'|'$/g, '')).filter(Boolean);
  // The rules list is allowed to omit aliases the rules normalise away, but may
  // never contain a role the authority does not have.
  inRules.forEach((role) => assert.ok(AUTHORITY.includes(role), `firestore.rules allows ${role}, which is not in the authority`));
  ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'outpatient_pharmacy_supervisor']
    .forEach((role) => assert.ok(inRules.includes(role), `firestore.rules is missing ${role}`));
});

test('the Cloud Functions read the authority rather than their own copy', async () => {
  const source = await readFile(new URL('../functions/crash-cart-report.js', import.meta.url), 'utf8');
  assert.match(source, /require\('\.\/crash-cart-operator-roles\.json'\)\.roles/);
  assert.ok(!/const allowed = \[\s*'master'/.test(source), 'the functions must not keep their own list');
});

test('the browser capability agrees with the authority', () => {
  for (const role of ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'outpatient_pharmacy_supervisor']) {
    assert.equal(hasCapability({ role }, 'crashCart.operate'), true, role);
    assert.ok(AUTHORITY.includes(role), `${role} holds the capability but is not in the authority`);
  }
  for (const role of ['department', 'warehouse', 'controlled_pharmacy']) {
    assert.equal(hasCapability({ role }, 'crashCart.operate'), false, role);
    assert.ok(!AUTHORITY.includes(role), `${role} is in the authority but holds no capability`);
  }
});

test('closing a report goes through the server, not two writes from the page', async () => {
  /* Two writes with a hand-written rollback, and the arithmetic on the page:
     nothing checked the quantities, and a browser closed between the writes left
     a sealed trolley recorded as holding what it does not. */
  const ui = await readFile(new URL('../public/assets/js/modules/80-controlled-pharmacy-ui-redesign.js', import.meta.url), 'utf8');
  assert.match(ui, /fsCallFunction\('closeCrashCartReport'/);
  assert.ok(!/await setCrashCarts\(carts\);try\{await saveCrashReport\(r\)\}/.test(ui), 'the two-write path is gone');
  const fn = await readFile(new URL('../functions/crash-cart-report.js', import.meta.url), 'utf8');
  assert.match(fn, /exports\.closeCrashCartReport = onCall/);
  // Cart and report are written in the same transaction.
  const block = /exports\.closeCrashCartReport[\s\S]*?await db\.runTransaction\(([\s\S]*?)\n  \} catch/.exec(fn);
  assert.ok(block && /transaction\.set\(refs\.carts/.test(block[1]) && /transaction\.set\(refs\.reportsCollection/.test(block[1]));
});
