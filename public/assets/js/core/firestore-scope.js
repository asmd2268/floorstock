export function tenantIdFromProfile(profile) {
  return String(profile && profile.tenantId || '').trim();
}

export function stateCollectionPath(profile) {
  const tenantId = tenantIdFromProfile(profile);
  return tenantId ? `tenants/${tenantId}/state` : 'floorstock_state';
}

Object.assign(globalThis, { tenantIdFromProfile, stateCollectionPath });
