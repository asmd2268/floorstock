const ROLE_ALIASES = Object.freeze({
  pharmacy_director: 'pharmacy',
  'pharmacy director': 'pharmacy',
  master: 'pharmacy',
  inpatient_pharmacy_supervisor: 'inpatient_supervisor',
  'inpatient-pharmacy-supervisor': 'inpatient_supervisor',
  'inpatient pharmacy supervisor': 'inpatient_supervisor',
  inpatient_supervisor: 'inpatient_supervisor',
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

export function hasCapability(profile, capability) {
  const user = profile || {};
  const role = normalizeRole(user.role);
  const master = user.master === true;
  if (master) return true;

  const capabilities = {
    'inventory.read': ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff'],
    'inventory.manage': ['pharmacy', 'inpatient_supervisor'],
    'requests.manage': ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff'],
    'schedule.read': ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff'],
    'schedule.manage': ['pharmacy'],
    'crashCart.read': ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'department'],
    'crashCart.operate': ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff'],
    'crashCart.configure': ['pharmacy', 'inpatient_supervisor'],
    'crashCart.delete': ['pharmacy'],
    'accountability.read': ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'department', 'controlled_pharmacy'],
    'accountability.manage': ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff'],
    'accountability.handover.create': ['pharmacy', 'inpatient_supervisor', 'pharmacy_staff'],
    'controlled.manage': ['pharmacy', 'controlled_pharmacy'],
    'departments.manage': ['pharmacy'],
    'users.manage': ['pharmacy']
  };
  return (capabilities[capability] || []).includes(role);
}

export function canWriteStateKey(profile, key) {
  const user = profile || {};
  const role = normalizeRole(user.role);
  const value = String(key || '');
  const master = user.master === true;
  if (master || role === 'pharmacy') return true;
  if (value === 'theme' || value === 'audit_log') return true;

  if (role === 'inpatient_supervisor') {
    return /^(crash_.*|accountability_.*|requests$|notes$|dept_notes$|meds_.*|expiry_.*|shelves_.*|alerts_.*|request_analytics_archive$|deleted_request_audit_v4$|department_request_notifications_v1$|pharmacy_.*|inventory_.*|inventory_name_merge_history$|manual_medicine_merge_history_v1$|similar_medicine_separations_v1$|custom_categories$|facility_logo$|hidden_request_categories_v1$|global_request_freeze_v2$|medication_(visibility|freeze)_rules_v3$|audit_log$|theme$)/.test(value);
  }
  if (role === 'pharmacy_staff') {
    return /^(crash_carts$|crash_cart_reports$|accountability_.*|requests$|notes$|dept_notes$|request_analytics_archive$|audit_log$|theme$)/.test(value);
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

