export const FULFILLMENT_EDIT_SETTINGS_KEY = 'fulfillment_edit_settings_v1';
export const DEFAULT_FULFILLMENT_EDIT_HOURS = 24;
export const MAX_FULFILLMENT_EDIT_HOURS = 8760;

export function normalizeFulfillmentEditHours(value) {
  const raw = value && typeof value === 'object' ? value.hours : value;
  if (raw === null || raw === undefined || raw === '') return DEFAULT_FULFILLMENT_EDIT_HOURS;
  const hours = Number(raw);
  if (!Number.isFinite(hours)) return DEFAULT_FULFILLMENT_EDIT_HOURS;
  return Math.min(MAX_FULFILLMENT_EDIT_HOURS, Math.max(0, hours));
}

export function fulfillmentEditDeadline(request, settings) {
  const fulfilledAt = new Date(request && request.fulfilledAt || '').getTime();
  if (!Number.isFinite(fulfilledAt)) return null;
  return fulfilledAt + normalizeFulfillmentEditHours(settings) * 60 * 60 * 1000;
}

function normalizedRole(profile) {
  const raw = String(profile && profile.role || '').trim().toLowerCase();
  if (raw === 'pharmacy_director' || raw === 'pharmacy director') return 'pharmacy';
  if (raw === 'inpatient_pharmacy_supervisor' || raw === 'inpatient pharmacy supervisor') return 'inpatient_supervisor';
  return raw;
}

function explicitDepartmentScope(profile) {
  const values = [
    profile && profile.allowedDepartmentIds,
    profile && profile.managedDepartmentIds,
    profile && profile.departmentIds,
    profile && profile.deptIds,
  ].find(Array.isArray);
  return values ? values.map(String) : null;
}

export function fulfillmentEditRoleAllowed(request, profile) {
  if (!request || !profile) return false;
  if (profile.master === true) return true;
  const role = normalizedRole(profile);
  const requestDept = String(request.deptId || request.departmentId || '');
  if (role === 'department') {
    return !!requestDept && requestDept === String(profile.deptId || profile.departmentId || '');
  }
  if (!['pharmacy', 'inpatient_supervisor', 'pharmacy_staff'].includes(role)) return false;
  const scope = explicitDepartmentScope(profile);
  return !scope || scope.includes(requestDept);
}

export function canEditFulfillment(request, profile, settings, now = Date.now()) {
  if (!request || request.status !== 'fulfilled' || !fulfillmentEditRoleAllowed(request, profile)) return false;
  if (profile && profile.master === true) return true;
  const deadline = fulfillmentEditDeadline(request, settings);
  const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return deadline !== null && Number.isFinite(at) && at <= deadline;
}

export function fulfillmentEditReason(request, profile, settings, now = Date.now()) {
  if (!request || request.status !== 'fulfilled') return 'Request is not fulfilled.';
  if (!fulfillmentEditRoleAllowed(request, profile)) return 'This account is not allowed to edit this fulfillment.';
  if (profile && profile.master === true) return '';
  const deadline = fulfillmentEditDeadline(request, settings);
  if (deadline === null) return 'The fulfillment timestamp is missing or invalid.';
  const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(at) || at > deadline) return 'The fulfillment editing window has expired.';
  return '';
}
