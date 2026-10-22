import test from 'node:test';
import assert from 'node:assert/strict';
import { KEPT_RANGES, isOnDemandStateKey, stateRunQueries, documentsFromRunQuery } from '../public/assets/js/core/state-list-query.js';

const kept = (id) => KEPT_RANGES.some(([low, high]) => (low === null || id >= low) && (high === null || id < high));

test('snapshot documents are the only ones the three ranges leave out', () => {
  const ids = [
    'requests', 'meds_icu', 'inventory_name_merge_history', 'inventory_integrity_icu', 'inventory_snapshot', 'inventory_snapshot_',
    'inventory_snapshot_icu_mveznuxe_xzx9_meds', 'inventory_snapshot_icu_mveznuxe_xzx9_expiry',
    'inventory_snapshot_index_icu', 'inventory_snapshot_index_msw', 'inventory_snapshot_index_',
    'inventory_snapshot_zzz_abc_meds', 'inventory_snapshot_msw_abc_meds', 'inventory_snapshota', 'inventory_snapshot`', 'inventory_snapshot_`',
    'inventory_snapshotz', 'inventory_r659_july27_restore_done', 'zzz', '0', 'Inventory_snapshot_icu_x',
  ];
  for (const id of ids) assert.equal(kept(id), !isOnDemandStateKey(id), id);
});

test('a snapshot key is on demand; the index of snapshots is not', () => {
  assert.equal(isOnDemandStateKey('inventory_snapshot_icu_abc_def_meds'), true);
  assert.equal(isOnDemandStateKey('inventory_snapshot_icu_abc_def_expiry'), true);
  assert.equal(isOnDemandStateKey('inventory_snapshot_index_icu'), false);
  assert.equal(isOnDemandStateKey('meds_icu'), false);
});

const BASE = 'https://firestore.googleapis.com/v1/projects/floorstock-6ac2d/databases/(default)/documents';

test('the queries name the collection, the three ranges and the full document references', () => {
  const queries = stateRunQueries(BASE, 'floorstock_state', 'KEY');
  assert.equal(queries.length, 3);
  for (const q of queries) {
    assert.equal(q.url, BASE + ':runQuery?key=KEY');
    assert.deepEqual(q.body.structuredQuery.from, [{ collectionId: 'floorstock_state' }]);
  }
  const first = queries[0].body.structuredQuery.where.fieldFilter;
  assert.equal(first.op, 'LESS_THAN');
  assert.equal(first.field.fieldPath, '__name__');
  assert.equal(first.value.referenceValue, 'projects/floorstock-6ac2d/databases/(default)/documents/floorstock_state/inventory_snapshot_');
  const middle = queries[1].body.structuredQuery.where.compositeFilter;
  assert.equal(middle.op, 'AND');
  assert.deepEqual(middle.filters.map((f) => f.fieldFilter.op), ['GREATER_THAN_OR_EQUAL', 'LESS_THAN']);
  assert.equal(queries[2].body.structuredQuery.where.fieldFilter.op, 'GREATER_THAN_OR_EQUAL');
});

test('a tenant collection is queried under its parent document', () => {
  const [q] = stateRunQueries(BASE, 'tenants/acme/state', '');
  assert.equal(q.url, BASE + '/tenants/acme:runQuery');
  assert.deepEqual(q.body.structuredQuery.from, [{ collectionId: 'state' }]);
  assert.match(q.body.structuredQuery.where.fieldFilter.value.referenceValue, /documents\/tenants\/acme\/state\/inventory_snapshot_$/);
});

test('the emulator base is turned into the same resource path', () => {
  const [q] = stateRunQueries('http://127.0.0.1:8080/v1/projects/demo-floorstock-emulator/databases/(default)/documents', 'floorstock_state', '');
  assert.match(q.body.structuredQuery.where.fieldFilter.value.referenceValue, /^projects\/demo-floorstock-emulator\/databases\/\(default\)\/documents\/floorstock_state\//);
});

test('documents come out of the answer, and an empty range yields none', () => {
  assert.deepEqual(documentsFromRunQuery([{ document: { name: 'a' }, readTime: 't' }, { document: { name: 'b' } }]).map((d) => d.name), ['a', 'b']);
  assert.deepEqual(documentsFromRunQuery([{ readTime: 't' }]), []);
  assert.deepEqual(documentsFromRunQuery(null), []);
});
