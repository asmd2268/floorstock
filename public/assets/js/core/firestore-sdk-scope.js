import { tenantIdFromProfile } from './firestore-scope.js?v=85dd92440a';
import { collectionSpecFor } from './collection-backed-keys.js?v=9ed94061f1';

export function stateCollectionRef(db, profile) {
  const tenantId = tenantIdFromProfile(profile);
  return tenantId ? db.collection('tenants').doc(tenantId).collection('state') : db.collection('floorstock_state');
}

// One document per row, for any key in the collection-backed registry. The
// tenant deployment nests them under the tenant; the legacy deployment keeps
// them at the top level under the spec's legacy name.
export function collectionRefForSpec(db, spec, profile) {
  const tenantId = tenantIdFromProfile(profile);
  return tenantId
    ? db.collection('tenants').doc(tenantId).collection(spec.tenantPath)
    : db.collection(spec.legacyPath);
}

// Retained for the Crash Cart callable adapter and the modules that write
// reports directly. New collection-backed keys go through the registry.
export function crashReportsCollectionRef(db, profile) {
  return collectionRefForSpec(db, collectionSpecFor('crash_cart_reports'), profile);
}

globalThis.stateCollectionRef = stateCollectionRef;
globalThis.collectionRefForSpec = collectionRefForSpec;
globalThis.crashReportsCollectionRef = crashReportsCollectionRef;
