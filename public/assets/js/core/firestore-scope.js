export function tenantIdFromProfile(profile) {
  return String(profile && profile.tenantId || '').trim();
}

export function stateCollectionPath(profile) {
  const tenantId = tenantIdFromProfile(profile);
  return tenantId ? `tenants/${tenantId}/state` : 'floorstock_state';
}

// Same tenant/legacy split as crashReportsCollectionRef() (SDK side) and
// functions/crash-cart-report.js's stateRefs() (Cloud Function side) — the
// REST polling path (scoped roles) needs a path string instead of an SDK ref.
export function crashReportsCollectionPath(profile) {
  const tenantId = tenantIdFromProfile(profile);
  return tenantId ? `tenants/${tenantId}/crash_cart_reports` : 'crash_cart_reports_v2';
}

Object.assign(globalThis, { tenantIdFromProfile, stateCollectionPath, crashReportsCollectionPath });
