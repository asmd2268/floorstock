import { collectionPathForSpec, collectionSpecFor } from './collection-backed-keys.js?v=15e4458489';

export function tenantIdFromProfile(profile) {
  return String(profile && profile.tenantId || '').trim();
}

export function stateCollectionPath(profile) {
  const tenantId = tenantIdFromProfile(profile);
  return tenantId ? `tenants/${tenantId}/state` : 'floorstock_state';
}

// Same tenant/legacy split as collectionRefForSpec() (SDK side) and
// functions/crash-cart-report.js's stateRefs() (Cloud Function side) — the
// REST polling path (scoped roles) needs a path string instead of an SDK ref.
export function collectionBackedPath(spec, profile) {
  return collectionPathForSpec(spec, tenantIdFromProfile(profile));
}

// Retained for the Crash Cart callable adapter and its tests, which name this
// one collection directly. New collection-backed keys go through the registry.
export function crashReportsCollectionPath(profile) {
  return collectionBackedPath(collectionSpecFor('crash_cart_reports'), profile);
}

Object.assign(globalThis, { tenantIdFromProfile, stateCollectionPath, collectionBackedPath, crashReportsCollectionPath });
