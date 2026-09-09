import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  PARTITIONED_STATE_KEYS,
  baseStateKey,
} from '../public/assets/js/core/partitioned-key-names.js';
import { canWriteStateKey } from '../public/assets/js/core/role-capabilities.js';

/* A month partition is the same record as the key it belongs to, so it must
   carry the same permissions. That was previously restated at every rule site as
   `requests(_g\d{4}-\d{2}(_p\d+)?)?`, once in firestore.rules and once in
   role-capabilities.js — the shape that already produced one silent permission
   bug (a double-escaped \\d that matched a literal backslash). It is now stated
   once on each side, and this test holds the two sides identical. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const operational = await readFile(new URL('core/operational-partitions.js', jsRoot), 'utf8');
const capabilities = await readFile(new URL('core/role-capabilities.js', jsRoot), 'utf8');

test('firestore.rules and the client agree on which keys are partitioned', () => {
  const match = /function stateKey\(docId\) \{\s*return docId\.matches\('\^\(([^)]+)\)_\[gh\]/.exec(rules);
  assert.ok(match, 'firestore.rules must declare stateKey() with the partitioned key list');
  const inRules = match[1].split('|').sort();
  assert.deepEqual(inRules, [...PARTITIONED_STATE_KEYS].sort());
});

test('every registered partitioned key is in the shared list', () => {
  const registered = [...operational.matchAll(/key: '([a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.ok(registered.length >= 5);
  registered.forEach((key) => {
    assert.ok(PARTITIONED_STATE_KEYS.includes(key), `${key} is registered but missing from PARTITIONED_STATE_KEYS`);
  });
});

test('a partition resolves to its base key, and nothing else does', () => {
  assert.equal(baseStateKey('dept_notes_g2026-09'), 'dept_notes');
  assert.equal(baseStateKey('requests_g2026-03_p2'), 'requests');
  assert.equal(baseStateKey('controlled_moves_h1447-03'), 'controlled_moves');
  // An id that merely looks like a partition of something unregistered keeps its
  // own identity, so nothing inherits permissions by accident.
  assert.equal(baseStateKey('inventory_snapshot_icu_g2026-01'), 'inventory_snapshot_icu_g2026-01');
  assert.equal(baseStateKey('requests'), 'requests');
  assert.equal(baseStateKey('requests_summary'), 'requests_summary');
});

test('a role may write a partition exactly where it may write the key', () => {
  const department = { role: 'department', deptId: 'icu' };
  assert.equal(canWriteStateKey(department, 'dept_notes'), true);
  assert.equal(canWriteStateKey(department, 'dept_notes_g2026-09'), true);
  assert.equal(canWriteStateKey(department, 'requests_g2026-09_p3'), true);
  // And nowhere it may not: usage submissions go through the callable.
  assert.equal(canWriteStateKey(department, 'accountability_usage_v2_h1447-02'), false);
  const warehouse = { role: 'warehouse' };
  assert.equal(canWriteStateKey(warehouse, 'controlled_pdf_receipts_h1447-02'), true);
  assert.equal(canWriteStateKey(warehouse, 'dept_notes_g2026-09'), false);
});

test('the suffix is not spelled out again in either permission source', () => {
  // The whole point of stateKey()/baseStateKey() is that it is written once.
  assert.ok(!/requests\(_g/.test(capabilities), 'role-capabilities must not restate the partition suffix');
  const withoutHelper = rules.replace(/function stateKey\(docId\)[\s\S]*?\n    \}/, '');
  assert.ok(!/_\[gh\]\[0-9\]\{4\}/.test(withoutHelper), 'firestore.rules must not restate the partition suffix');
});

test('every partitioned key is actually loaded by the roles that write it', async () => {
  /* partitionsAreLive() answers "is the legacy document still the live record?"
     by looking for it in the session cache — so a session that never loads the
     key answers yes to the partitions while the legacy document still holds the
     history, and the two halves diverge. Worse, before partitioning, the writers
     saved the whole array they had read: for an unloaded key that is an array of
     one, so a supervisor's deletion replaced the entire deletion audit.
     Every key a scoped role writes must therefore appear in that role's key
     list. */
  const stateModule = await readFile(new URL('modules/03-core-application-firebase-state-auth.js', jsRoot), 'utf8');
  const pharmacyScoped = /PHARMACY_SCOPED_STATE_KEYS = Object\.freeze\(\[([\s\S]*?)\]\)/.exec(stateModule)[1];
  for (const key of ['requests', 'dept_notes', 'deleted_request_audit_v4', 'department_request_notifications_v1', 'user_activity_daily_v1', 'accountability_receipts_v2']) {
    assert.ok(pharmacyScoped.includes(`'${key}'`), `${key} must be loaded by pharmacy-scoped roles`);
  }
  const warehouse = /WAREHOUSE_STATE_KEYS = Object\.freeze\(\[([\s\S]*?)\]\)/.exec(stateModule)[1];
  for (const key of ['controlled_moves', 'controlled_pdf_receipts', 'user_activity_daily_v1']) {
    assert.ok(warehouse.includes(`'${key}'`), `${key} must be loaded by the warehouse role`);
  }
  const controlled = /CONTROLLED_PHARMACY_BASE_KEYS = Object\.freeze\(\[([\s\S]*?)\]\)/.exec(stateModule)[1];
  for (const key of ['controlled_moves', 'controlled_pdf_receipts', 'user_activity_daily_v1']) {
    assert.ok(controlled.includes(`'${key}'`), `${key} must be loaded by the controlled pharmacy role`);
  }
  const department = /DEPARTMENT_SHARED_STATE_KEYS = Object\.freeze\(\[([\s\S]*?)\]\)/.exec(stateModule)[1];
  for (const key of ['requests', 'dept_notes', 'accountability_receipts_v2', 'user_activity_daily_v1']) {
    assert.ok(department.includes(`'${key}'`), `${key} must be loaded by department sessions`);
  }
});
