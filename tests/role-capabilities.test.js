import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { canAccessDepartment, canAccessPage, hasCapability, normalizeRole } from '../public/assets/js/core/role-capabilities.js';

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

/* ── Nav page visibility: one source ──────────────────────────────────────────
   The recurring defect: buildNav answered "who may see page X" with a separate
   hardcoded array per role, so an edit to one array silently re-granted
   🧾 Medication Accountability to outpatient_pharmacy_supervisor, which the
   capability table denies. These tests read the REAL catalogue out of module 80
   and run it through the real policy, so the two cannot drift again. */

const navSource = await readFile(new URL('../public/assets/js/modules/80-controlled-pharmacy-ui-redesign.js', import.meta.url), 'utf8');

function navCatalog() {
  const match = navSource.match(/var NAV_CATALOG=(\[[\s\S]*?\]);\n/);
  assert.ok(match, 'module 80 must declare a single NAV_CATALOG (order and labels only)');
  return new Function(`return ${match[1]}`)();
}

function navFor(role) {
  return navCatalog()
    .filter((entry) => canAccessPage({ role }, entry[0]))
    .map((entry) => [entry[0], (entry[2] && entry[2][role]) || entry[1]]);
}

test('nav carries no per-role page list of its own', () => {
  const buildNav = navSource.slice(navSource.indexOf('window.buildNav='), navSource.indexOf('// Inject sub-tabs'));
  /* The recurring defect had one shape: a page list written out again for a
     catalogue role. Everything between the role test and the department branch
     must therefore name no catalogue page at all. (The department branch below
     it stays dynamic and keeps its own pushes.) */
  const roleBranches = buildNav.slice(buildNav.indexOf('var rRole='), buildNav.indexOf('else{'));
  for (const page of navCatalog().map((entry) => entry[0])) {
    assert.ok(!roleBranches.includes(page), `${page} is named per role instead of coming from the catalogue`);
  }
  assert.match(roleBranches, /canAccessPage\(\{role:rRole\}/);
});

test('every supervising role keeps Medication Accountability, outpatient included', () => {
  /* The outpatient pharmacy supervisor holds custody for the outpatient
     department beneath them, so they need this page. An earlier pass removed
     it from them by misreading the report — the defect was never the page, it
     was the badge counting rows the account cannot open (asserted below). */
  for (const role of ['pharmacy', 'inpatient_supervisor', 'outpatient_pharmacy_supervisor', 'pharmacy_staff']) {
    assert.ok(navFor(role).some((x) => x[0] === 'pg-med-accountability'), `${role} lost the page`);
    assert.equal(canAccessPage({ role }, 'pg-med-accountability'), true);
    assert.equal(hasCapability({ role }, 'accountability.read'), true);
  }
});

test('the accountability badge counts only rows the account may open', () => {
  /* A ward with no custody of its own was shown "2" from other wards, on a page
     that then said "No active custody medicines assigned". The crash-cart and
     request badges beside it always scoped by fsCanAccessDepartment; this one
     counted the whole tenant. */
  assert.match(navSource, /_accScoped\s*=\s*function/);
  assert.match(navSource, /fsCanAccessDepartment\(u\.deptId\)/);
  // both reads still go through S.g by name, which one-reader-per-key also checks
  assert.match(navSource, /_accScoped\(S\.g\('accountability_usage_v2'\)\)/);
  assert.match(navSource, /_accScoped\(S\.g\('accountability_plan_usage_v1'\)\)/);
});

test('every role’s navigation is exactly what it was before the per-role arrays went away', () => {
  /* Every entry below is the list buildNav produced BEFORE the per-role arrays
     were replaced — every role, unchanged. */
  assert.deepEqual(navFor('pharmacy'), [
    ['pg-dash', 'Dashboard'], ['pg-inv', 'Inventory'], ['pg-pharm-inv', '🏥 Pharm Inventory'],
    ['pg-reqs', 'Requests'], ['pg-notes-ph', '📝 Notes'], ['pg-print', 'Print'],
    ['pg-analytics', 'Analytics'], ['pg-users', '👥 Users'], ['pg-crashcart', '🚑 Crash Carts'],
    ['pg-med-accountability', '🧾 Medication Accountability']]);
  assert.deepEqual(navFor('inpatient_supervisor'), [
    ['pg-dash', 'Dashboard'], ['pg-inv', 'Inventory'], ['pg-reqs', 'Requests'],
    ['pg-notes-ph', '📝 Notes'], ['pg-print', 'Print'], ['pg-analytics', 'Analytics'],
    ['pg-users', '👥 Users'], ['pg-crashcart', '🚑 Crash Carts'],
    ['pg-med-accountability', '🧾 Medication Accountability']]);
  assert.deepEqual(navFor('outpatient_pharmacy_supervisor'), [
    ['pg-dash', 'Dashboard'], ['pg-inv', 'Inventory'], ['pg-pharm-inv', '🏥 Pharm Inventory'],
    ['pg-reqs', 'Requests'], ['pg-notes-ph', '📝 Notes'], ['pg-print', 'Print'],
    ['pg-crashcart', '🚑 Crash Carts'],
    ['pg-med-accountability', '🧾 Medication Accountability']]);
  assert.deepEqual(navFor('pharmacy_staff'), [
    ['pg-dash', 'Dashboard'], ['pg-inv', 'Inventory status / حالة الأدوية'],
    ['pg-pharm-inv', '🏥 Pharm Inventory'], ['pg-reqs', 'Requests'], ['pg-notes-ph', '📝 Notes'],
    ['pg-print', 'Print'], ['pg-crashcart', '🚑 Crash Carts'],
    ['pg-med-accountability', '🧾 Medication Accountability']]);
});

test('a hidden page cannot show a badge, and direct navigation to it is refused', () => {
  assert.match(navSource, /if\(ab&&!navAllows\(badgeRole,'pg-med-accountability'\)\)ab=null/);
  const routing = readFileSync(new URL('../public/assets/js/modules/12-local-daily-backups-system-health.js', import.meta.url), 'utf8');
  assert.match(routing, /canAccessPage\(\{role:role\(\)\},id\)/);
  assert.match(routing, /role-capabilities\.js/);
});
