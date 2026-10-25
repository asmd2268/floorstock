import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopedStateLoader } from '../public/assets/js/core/scoped-state-loader.js';

function make(overrides = {}) {
  const asked = [];
  const loaderApi = createScopedStateLoader({
    overflowProbeKeys: overrides.overflowProbeKeys || (() => []),
    scopeCache: (cache) => cache,
    keysForProfile: overrides.keysForProfile || (() => null),
    pharmacyFallbackKeys: () => ['departments', 'users_x', 'theme'],
    controlledFallbackKeys: () => ['departments', 'controlled_catalog'],
    controlledDeptKeys: (cache) => (cache.departments || []).map((d) => 'controlled_dept_list_' + d.id),
    pharmacyDeptKeys: (cache) => (cache.departments || []).map((d) => 'meds_' + d.id),
  });
  const docs = overrides.docs || {};
  const loader = async (key) => {
    asked.push(key);
    if (docs[key] instanceof Error) throw docs[key];
    return docs[key] === undefined ? null : docs[key];
  };
  return { api: loaderApi, loader, asked };
}

const quiet = async (fn) => { const warn = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = warn; } };

test('a refused document is reported and the permitted ones are kept', async () => {
  const { api, loader } = make({ docs: { a: 1, b: new Error('denied'), c: null, d: 0 } });
  const result = await quiet(() => api.loadScoped(['a', 'b', 'c', 'd'], loader, 'rest'));
  assert.deepEqual(result.cache, { a: 1, d: 0 });
  assert.deepEqual(result.failedKeys, ['b']);
  assert.equal(result.source, 'rest');
});

test('continuation parts are read only when a document asks for them, and only until none are found', async () => {
  let round = 0;
  const { api, loader, asked } = make({
    docs: { big: { n: 1 }, big_p2: { n: 2 } },
    overflowProbeKeys: (cache) => { round += 1; return round === 1 ? ['big_p2'] : round === 2 ? ['big_p3'] : []; },
  });
  const result = await api.loadScoped(['big'], loader, 'rest');
  assert.deepEqual(Object.keys(result.cache).sort(), ['big', 'big_p2']);
  assert.deepEqual(asked, ['big', 'big_p2', 'big_p3']);
});

test('a session that holds nothing large asks for no continuations', async () => {
  const { api, loader, asked } = make({ docs: { a: 1 } });
  await api.loadScoped(['a'], loader, 'rest');
  assert.deepEqual(asked, ['a']);
});

test('department-scoped roles are flagged, other roles are not', async () => {
  const { api, loader } = make({ docs: { a: 1 } });
  const dept = await api.loadScoped(['a'], loader, 'rest', { role: 'department' });
  const outpatient = await api.loadScoped(['a'], loader, 'rest', { role: 'outpatient_pharmacy_supervisor' });
  const pharmacy = await api.loadScoped(['a'], loader, 'rest', { role: 'pharmacy_staff' });
  assert.equal(dept.cache.__scopedDepartmentState, true);
  assert.equal(outpatient.cache.__scopedDepartmentState, true);
  assert.equal(pharmacy.cache.__scopedDepartmentState, undefined);
  assert.equal(Object.keys(dept.cache).includes('__scopedDepartmentState'), false);
});

test('the pharmacy loader asks for the listener list minus departments, plus each department', async () => {
  const { api, loader, asked } = make({
    keysForProfile: () => ['departments', 'orders', 'audit_log_2026-10'],
    docs: { departments: [{ id: 'icu' }], orders: [1], meds_icu: [2] },
  });
  const result = await api.loadPharmacy({ role: 'pharmacy_staff' }, loader, 'rest');
  assert.deepEqual(asked.slice().sort(), ['audit_log_2026-10', 'departments', 'meds_icu', 'orders']);
  assert.deepEqual(Object.keys(result.cache).sort(), ['departments', 'meds_icu', 'orders']);
});

test('without a listener list the pharmacy loader falls back to its constant list', async () => {
  const { api, loader, asked } = make({ docs: { departments: [] } });
  await api.loadPharmacy({ role: 'pharmacy_staff' }, loader, 'rest');
  assert.deepEqual(asked.slice().sort(), ['departments', 'theme', 'users_x']);
});

test('the controlled-pharmacy loader adds each department list after the first wave', async () => {
  const { api, loader, asked } = make({
    keysForProfile: () => ['departments', 'controlled_catalog'],
    docs: { departments: [{ id: 'd1' }], controlled_catalog: [1], controlled_dept_list_d1: [3] },
  });
  const result = await api.loadControlledPharmacy({ role: 'controlled_pharmacy' }, loader, 'rest');
  assert.deepEqual(asked, ['departments', 'controlled_catalog', 'controlled_dept_list_d1']);
  assert.deepEqual(result.cache.controlled_dept_list_d1, [3]);
});
