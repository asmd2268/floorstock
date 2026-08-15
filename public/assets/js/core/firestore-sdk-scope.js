import { tenantIdFromProfile } from './firestore-scope.js';

export function stateCollectionRef(db, profile) {
  const tenantId = tenantIdFromProfile(profile);
  return tenantId ? db.collection('tenants').doc(tenantId).collection('state') : db.collection('floorstock_state');
}

// Phase 2a: individual crash cart report documents, dual-written by the
// submit/accept/reject Cloud Functions alongside the legacy state-doc array
// (see functions/crash-cart-report.js stateRefs()). Same tenant/legacy split.
export function crashReportsCollectionRef(db, profile) {
  const tenantId = tenantIdFromProfile(profile);
  return tenantId
    ? db.collection('tenants').doc(tenantId).collection('crash_cart_reports')
    : db.collection('crash_cart_reports_v2');
}

globalThis.stateCollectionRef = stateCollectionRef;
globalThis.crashReportsCollectionRef = crashReportsCollectionRef;
