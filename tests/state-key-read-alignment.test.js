import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/* The client fetches a fixed list of state documents per role, and firestore.rules
 * decides which of them that role may read. Those two lists are maintained in
 * different files and drifted apart three separate times: accountability_expiry_batches_v1
 * and accountability_plan_usage_v1 were fetched but unreadable, so expiry batches
 * saved without ever loading back and plan submissions never appeared, and
 * user_dept_restrictions_v1 produced a permission-denied on every department
 * session. Each failed silently — the loader records the failure and carries on —
 * so nothing surfaced until someone noticed missing data.
 *
 * This compares the two lists directly. It reads the rules as text rather than
 * running them: the emulator suite already exercises the rules themselves, what is
 * missing is the cross-file check that the client never asks for a document the
 * rules will refuse.
 */

const core = readFileSync('public/assets/js/modules/03-core-application-firebase-state-auth.js', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');

/** Literal 'quoted' keys inside a named JS array, ignoring template-built ones. */
function clientKeys(name) {
  const start = core.indexOf(`globalThis.${name}`);
  assert.ok(start > -1, `${name} not found`);
  const end = core.indexOf(']);', start);
  const body = core.slice(start, end);
  // Drop commented-out lines so an explanatory comment naming a key is not read
  // back as a fetched key.
  const live = body.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  return [...new Set([...live.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]))];
}

/** Literal keys allowed by a rules function, plus its regex prefixes. */
function rulesReadable(fnName) {
  const start = rules.indexOf(`function ${fnName}(`);
  assert.ok(start > -1, `${fnName} not found in firestore.rules`);
  // Stop at the next top-level function declaration.
  const rest = rules.slice(start + 1);
  const end = rest.indexOf('\n    function ');
  const body = rest.slice(0, end === -1 ? undefined : end);
  const literals = new Set([...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]));
  // Prefix families such as meds_, expiry_, shelves_ are matched by regex in the
  // rules; treat any key beginning with one of them as covered.
  const prefixes = [...body.matchAll(/\^\(([a-z0-9_|]+)\)/g)]
    .flatMap((m) => m[1].split('|'))
    .filter(Boolean);
  const inlinePrefixes = [...body.matchAll(/'([a-z0-9_]+_)'\s*\+/g)].map((m) => m[1]);
  return { literals, prefixes: [...prefixes, ...inlinePrefixes] };
}

function unreadable(keys, allowed) {
  return keys.filter((key) => {
    if (allowed.literals.has(key)) return false;
    // Per-department keys are built as 'meds_' + departmentId() in the rules.
    if (allowed.prefixes.some((p) => key.startsWith(p.replace(/\.\*$/, '')))) return false;
    return true;
  });
}

/* warehouse and controlled_pharmacy get their read permission from an inline
   branch of canReadScopedState rather than a named function, so their key lists
   went unguarded — which is how WAREHOUSE_STATE_KEYS came to fetch
   deleted_departments that the rule refused. */
function scopedBranchReadable(roleName) {
  // Scoped to canReadScopedState: the role name also appears in the small
  // predicates above it (warehouseOfficer, controlledOfficer), and matching one of
  // those instead would find no key literals and report every key as refused.
  const fnStart = rules.indexOf('function canReadScopedState');
  assert.ok(fnStart > -1, 'canReadScopedState not found in rules');
  const fnBody = rules.slice(fnStart, rules.indexOf('\n    function ', fnStart + 1));
  const line = fnBody.split('\n').find((l) => l.includes(`role() == '${roleName}'`));
  assert.ok(line, `no canReadScopedState branch found for ${roleName}`);
  const literals = new Set([...line.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]));
  const prefixes = [...line.matchAll(/\^\(([a-z0-9_|.*]+)\)/g)]
    .flatMap((m) => m[1].split('|'))
    .map((p) => p.replace(/\.\*$/, ''))
    .filter(Boolean);
  return { literals, prefixes };
}

test('every state key a warehouse session fetches is readable by warehouse', () => {
  const keys = clientKeys('WAREHOUSE_STATE_KEYS');
  const missing = unreadable(keys, scopedBranchReadable('warehouse'));
  assert.deepEqual(missing, [],
    `WAREHOUSE_STATE_KEYS asks for documents the warehouse rule refuses:\n  ${missing.join('\n  ')}`);
});

test('every state key a controlled-pharmacy session fetches is readable by that role', () => {
  const keys = clientKeys('CONTROLLED_PHARMACY_BASE_KEYS');
  const missing = unreadable(keys, scopedBranchReadable('controlled_pharmacy'));
  assert.deepEqual(missing, [],
    `CONTROLLED_PHARMACY_BASE_KEYS asks for documents the controlled_pharmacy rule refuses:\n  ${missing.join('\n  ')}`);
});

test('every state key a department session fetches is readable by departments', () => {
  const keys = clientKeys('DEPARTMENT_SHARED_STATE_KEYS');
  const allowed = rulesReadable('canReadDepartmentState');
  const missing = unreadable(keys, allowed);
  assert.deepEqual(missing, [],
    `DEPARTMENT_SHARED_STATE_KEYS asks for documents canReadDepartmentState refuses:\n  ${missing.join('\n  ')}`);
});

test('every state key a pharmacy-scoped session fetches is readable by those roles', () => {
  const keys = clientKeys('PHARMACY_SCOPED_STATE_KEYS');
  const allowed = rulesReadable('canReadPharmacyState');
  const missing = unreadable(keys, allowed);
  assert.deepEqual(missing, [],
    `PHARMACY_SCOPED_STATE_KEYS asks for documents canReadPharmacyState refuses:\n  ${missing.join('\n  ')}`);
});
