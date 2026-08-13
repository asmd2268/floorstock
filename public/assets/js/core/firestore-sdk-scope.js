import { tenantIdFromProfile } from './firestore-scope.js';

export function stateCollectionRef(db, profile) {
  const tenantId = tenantIdFromProfile(profile);
  return tenantId ? db.collection('tenants').doc(tenantId).collection('state') : db.collection('floorstock_state');
}

globalThis.stateCollectionRef = stateCollectionRef;
