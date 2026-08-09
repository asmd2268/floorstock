const LOGIN_ROLES = Object.freeze([
  'pharmacy',
  'department',
  'warehouse',
  'controlled_pharmacy',
  'inpatient_supervisor',
  'outpatient_pharmacy_supervisor',
  'pharmacy_staff',
]);

export function isSupportedLoginRole(role) {
  return LOGIN_ROLES.includes(String(role || ''));
}

export { LOGIN_ROLES };
globalThis.isSupportedLoginRole = isSupportedLoginRole;
