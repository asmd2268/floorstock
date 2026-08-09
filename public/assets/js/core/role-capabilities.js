const ROLE_ALIASES = Object.freeze({
  pharmacy_director: 'pharmacy',
  'pharmacy director': 'pharmacy',
  master: 'pharmacy',
  inpatient_pharmacy_supervisor: 'inpatient_supervisor',
  'inpatient-pharmacy-supervisor': 'inpatient_supervisor',
  'inpatient pharmacy supervisor': 'inpatient_supervisor',
  inpatient_supervisor: 'inpatient_supervisor',
  external_pharmacy_supervisor: 'outpatient_pharmacy_supervisor',
  outpatient_pharmacy_supervisor: 'outpatient_pharmacy_supervisor',
  'external pharmacy supervisor': 'outpatient_pharmacy_supervisor',
  'outpatient pharmacy supervisor': 'outpatient_pharmacy_supervisor',
  pharmacy_staff: 'pharmacy_staff',
  controlled_pharmacy: 'controlled_pharmacy',
  department: 'department',
  custodian: 'department',
  warehouse: 'warehouse',
  pharmacy: 'pharmacy'
});

export function normalizeRole(value) {
  const raw = String(value || '').trim().toLowerCase();
  return ROLE_ALIASES[raw] || raw;
}

export function resolvePermissionProfile({ currentUser = {}, effectiveUser = {}, actualUser = {}, previewUser = null } = {}) {
  if (previewUser) {
    const tested = { ...currentUser, ...previewUser, master: false };
    tested.role = normalizeRole(tested.role);
    tested.deptId = String(tested.deptId || tested.departmentId || '');
    return tested;
  }
  if (actualUser && actualUser.master === true) {
    const masterProfile = { ...actualUser, master: true };
    masterProfile.role = normalizeRole(masterProfile.role || 'pharmacy');
    masterProfile.deptId = String(masterProfile.deptId || masterProfile.departmentId || '');
    return masterProfile;
  }
  const effective = { ...effectiveUser };
  effective.role = normalizeRole(effective.role);
  effective.deptId = String(effective.deptId || effective.departmentId || '');
  return effective;
}

const CAPABILITIES = Object.freeze({
  'inventory.read': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff']),
  'inventory.manage': Object.freeze(['pharmacy', 'inpatient_supervisor']),
  'requests.manage': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'outpatient_pharmacy_supervisor']),
  'schedule.read': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'outpatient_pharmacy_supervisor']),
  'schedule.manage': Object.freeze(['pharmacy']),
  'crashCart.read': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'outpatient_pharmacy_supervisor', 'department']),
  'crashCart.operate': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'outpatient_pharmacy_supervisor']),
  'crashCart.configure': Object.freeze(['pharmacy', 'inpatient_supervisor']),
  'crashCart.delete': Object.freeze(['pharmacy']),
  'accountability.read': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'department', 'controlled_pharmacy']),
  'accountability.manage': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff']),
  'accountability.handover.create': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff']),
  'controlled.manage': Object.freeze(['pharmacy', 'controlled_pharmacy']),
  'departments.manage': Object.freeze(['pharmacy']),
  'users.manage': Object.freeze(['pharmacy'])
});

export function canAccessDepartment(profile, departmentId) {
  const user = profile || {};
  const role = normalizeRole(user.role);
  const target = String(departmentId || '').trim().toLowerCase();
  if (!target || user.master === true || role === 'pharmacy' || role === 'pharmacy_staff') return true;
  const own = String(user.deptId || user.departmentId || '').trim().toLowerCase();
  if (role === 'department') return !!own && own === target;
  if (role === 'outpatient_pharmacy_supervisor') return target === 'outpatient' || target === 'outpatient department' || (!!own && own === target);
  if (role === 'inpatient_supervisor') return target !== 'outpatient' && target !== 'outpatient department';
  return false;
}

export function hasCapability(profile, capability) {
  const user = profile || {};
  const role = normalizeRole(user.role);
  const master = user.master === true;
  if (master) return true;

  return (CAPABILITIES[String(capability || '')] || []).includes(role);
}

export function canWriteStateKey(profile, key) {
  const user = profile || {};
  const role = normalizeRole(user.role);
  const value = String(key || '');
  const master = user.master === true;
  if (value === 'fulfillment_edit_settings_v1') return master;
  if (master || role === 'pharmacy') return true;
  if (value === 'theme' || value === 'audit_log') return true;

  if (role === 'inpatient_supervisor') {
    return /^(crash_.*|accountability_.*|requests$|notes$|dept_notes$|meds_.*|expiry_.*|shelves_.*|alerts_.*|request_analytics_archive$|deleted_request_audit_v4$|department_request_notifications_v1$|pharmacy_.*|inventory_.*|inventory_name_merge_history$|manual_medicine_merge_history_v1$|similar_medicine_separations_v1$|custom_categories$|facility_logo$|hidden_request_categories_v1$|global_request_freeze_v2$|medication_(visibility|freeze)_rules_v3$|audit_log$|theme$)/.test(value);
  }
  if (role === 'pharmacy_staff') {
    return /^(crash_carts$|crash_cart_reports$|accountability_.*|requests$|notes$|dept_notes$|request_analytics_archive$|audit_log$|theme$)/.test(value);
  }
  if (role === 'outpatient_pharmacy_supervisor') {
    return /^(crash_carts$|crash_cart_reports$|requests$|notes$|dept_notes$|request_analytics_archive$|audit_log$|theme$)/.test(value);
  }
  if (role === 'controlled_pharmacy') {
    return /^(controlled_.*|accountability_.*|audit_log$|theme$)/.test(value);
  }
  if (role === 'warehouse') {
    return /^(controlled_warehouse$|controlled_moves$|controlled_pdf_receipts$|audit_log$|theme$)/.test(value);
  }
  if (role === 'department') {
    const deptId = String(user.deptId || user.departmentId || '');
    const ownSnapshotPrefix = deptId ? `inventory_snapshot_${deptId}_` : '';
    return value === 'requests' || value === 'dept_notes' || value === 'notes' || value === 'crash_cart_reports' ||
      value === 'accountability_usage_v2' || value === 'accountability_receipts_v2' ||
      (!!deptId && (value === `meds_${deptId}` || value === `expiry_${deptId}` || value === `shelves_${deptId}` ||
        value === `inventory_integrity_${deptId}` || value === `inventory_snapshot_index_${deptId}` ||
        value.startsWith(ownSnapshotPrefix) ||
        (user.controlledCustodian === true && (value === `controlled_dept_list_${deptId}` || value === `controlled_dept_shelves_${deptId}` || value === `controlled_settings_${deptId}`))));
  }
  return false;
}
export function canDeleteStateKey(profile, key) {
  const user = profile || {};
  const role = normalizeRole(user.role);
  const value = String(key || '');
  const master = user.master === true;
  if (master || role === 'pharmacy') return true;
  if (role === 'inpatient_supervisor' && /^inventory_snapshot_.*$/.test(value)) return true;
  if (role === 'department') {
    const deptId = String(user.deptId || user.departmentId || '');
    return !!deptId && value.startsWith(`inventory_snapshot_${deptId}_`);
  }
  return false;
}
