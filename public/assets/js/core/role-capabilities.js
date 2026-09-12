import { baseStateKey } from './partitioned-key-names.js?v=0cc33a7935';
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
  'crashCart.report': Object.freeze(['department']),
  'crashCart.operate': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff', 'outpatient_pharmacy_supervisor']),
  'crashCart.configure': Object.freeze(['pharmacy', 'inpatient_supervisor']),
  'crashCart.delete': Object.freeze(['pharmacy']),
  /* outpatient_pharmacy_supervisor holds custody for the outpatient department
     beneath them, so they read and manage it like any other supervisor. */
  'accountability.read': Object.freeze(['pharmacy', 'inpatient_supervisor', 'outpatient_pharmacy_supervisor', 'pharmacy_staff', 'department', 'controlled_pharmacy']),
  'accountability.manage': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff']),
  'accountability.handover.create': Object.freeze(['pharmacy', 'inpatient_supervisor', 'pharmacy_staff']),
  'controlled.manage': Object.freeze(['pharmacy', 'controlled_pharmacy']),
  'departments.manage': Object.freeze(['pharmacy']),
  'users.manage': Object.freeze(['pharmacy'])
});

/* Which department id IS the outpatient department.

   Two answers to that question had drifted apart. fsOutpatientDeptId() resolves
   it by NAME (/outpatient department/i) and returns whatever id that department
   actually carries — a Firestore auto-id in most tenants. This rule only ever
   accepted the literal ids 'outpatient' / 'outpatient department'. So a
   supervisor whose profile carries no deptId passed the caller's own dept
   filter and was then rejected here, and every request, note and cart vanished
   for them. Resolving it the same way is what keeps the two in agreement. */
function isOutpatientDepartment(target) {
  if (target === 'outpatient' || target === 'outpatient department') return true;
  try {
    const list = (globalThis.S && typeof globalThis.S.g === 'function') ? (globalThis.S.g('departments') || []) : [];
    return list.some(function (d) {
      if (String((d && d.id) || '').trim().toLowerCase() !== target) return false;
      return /outpatient\s+department/i.test(String((d && (d.name || d.nameEn)) || ''));
    });
  } catch (e) { return false; } /* an optional source that is not loaded in this session */
}

export function canAccessDepartment(profile, departmentId) {
  const user = profile || {};
  const role = normalizeRole(user.role);
  const target = String(departmentId || '').trim().toLowerCase();
  if (!target || user.master === true || role === 'pharmacy') return true;
  // Per-user blocked departments. Primary source: live state key written by the
  // setDeptRestrictions CF and synced in real-time — takes effect immediately
  // without re-login. Falls back to __fsBlockedDepts (set at login from token
  // claims or Firestore profile) for sessions where state is unavailable.
  const blocked = (function() {
    const userId = user.id || user.uid;
    if (userId && globalThis.S && typeof globalThis.S.g === 'function') {
      const map = globalThis.S.g('user_dept_restrictions_v1') || {};
      if (typeof map === 'object' && !Array.isArray(map) && Array.isArray(map[userId])) {
        return map[userId];
      }
    }
    return Array.isArray(globalThis.__fsBlockedDepts) ? globalThis.__fsBlockedDepts : [];
  })();
  if (blocked.some(function(d){ return String(d).trim().toLowerCase() === target; })) return false;
  if (role === 'pharmacy_staff') return true;
  const own = String(user.deptId || user.departmentId || '').trim().toLowerCase();
  if (role === 'department') return !!own && own === target;
  if (role === 'outpatient_pharmacy_supervisor') return isOutpatientDepartment(target) || (!!own && own === target);
  if (role === 'inpatient_supervisor') return true;
  return false;
}

export function hasCapability(profile, capability) {
  const user = profile || {};
  const role = normalizeRole(user.role);
  const master = user.master === true;
  if (master) return true;

  return (CAPABILITIES[String(capability || '')] || []).includes(role);
}

/* WHO may see a page — asked once, here.
   من يرى الصفحة: مصدر واحد لا غير.

   buildNav used to answer it with a separate hardcoded array per role, and
   module 83 keeps a third copy for its visibility switches. Every edit to one of
   those arrays re-granted a page the capability table denies, which is how
   outpatient_pharmacy_supervisor kept getting 🧾 Medication Accountability back.
   Where a capability already states the same fact, the entry READS that
   capability rather than restating its role list — restating it is the defect.
   Where no capability governs a page, the roles are written out: page visibility
   and data access are genuinely different facts for some pages (an outpatient
   supervisor opens Inventory without holding `inventory.read`). */
const PAGE_ROLES = Object.freeze({
  'pg-dash': Object.freeze(['pharmacy', 'inpatient_supervisor', 'outpatient_pharmacy_supervisor', 'pharmacy_staff']),
  'pg-inv': Object.freeze(['pharmacy', 'inpatient_supervisor', 'outpatient_pharmacy_supervisor', 'pharmacy_staff']),
  'pg-pharm-inv': Object.freeze(['pharmacy', 'outpatient_pharmacy_supervisor', 'pharmacy_staff']),
  'pg-reqs': CAPABILITIES['requests.manage'],
  'pg-notes-ph': Object.freeze(['pharmacy', 'inpatient_supervisor', 'outpatient_pharmacy_supervisor', 'pharmacy_staff']),
  'pg-print': Object.freeze(['pharmacy', 'inpatient_supervisor', 'outpatient_pharmacy_supervisor', 'pharmacy_staff']),
  'pg-analytics': Object.freeze(['pharmacy', 'inpatient_supervisor']),
  /* Not users.manage: that capability is pharmacy-only, while the Users PAGE has
     always been on the inpatient supervisor's nav (they read the roster; every
     mutating control on it checks users.manage for itself). Recorded as its own
     line so the difference stays deliberate rather than drifting. */
  'pg-users': Object.freeze(['pharmacy', 'inpatient_supervisor']),
  'pg-controlled': Object.freeze(['controlled_pharmacy', 'warehouse', 'department']),
  'pg-crashcart': CAPABILITIES['crashCart.read'],
  'pg-med-accountability': CAPABILITIES['accountability.read']
});

/* A page this table does not govern (sub-tabs, master tools, department request
   pages) is left to its own caller — answering `false` for it here would be this
   table inventing a rule nobody wrote. */
export function canAccessPage(profile, pageId) {
  const roles = PAGE_ROLES[String(pageId || '')];
  if (!roles) return true;
  const user = profile || {};
  if (user.master === true) return true;
  return roles.includes(normalizeRole(user.role));
}

export function canWriteStateKey(profile, key) {
  const user = profile || {};
  const role = normalizeRole(user.role);
  /* A month partition is the same record as its base key — `dept_notes_g2026-09`
     holds what `dept_notes` held — so the id is normalised once here and every
     rule below is written about the key itself. Spelling the suffix out again in
     each pattern is how one of them ends up wrong. */
  const value = baseStateKey(key);
  const master = user.master === true;
  if (value === 'fulfillment_edit_settings_v1') return master;
  if (master || role === 'pharmacy') return true;
  // audit_log is deliberately absent: it is write-denied in firestore.rules and
  // appended only through the appendAuditLog callable, which stamps the actor
  // server-side. A client state write would replace the whole document.
  /* accountability_usage_summary_v1 holds the archived monthly totals behind every
     consumption report. firestore.rules lists what each scoped role may write and
     does not include it, so the roles modelled below with a broad accountability_.*
     pattern must not claim it. controlled_pharmacy's rule really is that broad
     pattern, so it keeps the key. */
  if (value === 'accountability_usage_summary_v1') return role === 'controlled_pharmacy';
  if (value === 'theme' || value === 'user_activity_daily_v1') return true;

  if (role === 'inpatient_supervisor') {
    return /^(crash_.*|accountability_.*|requests$|notes$|dept_notes$|meds_.*|expiry_.*|shelves_.*|alerts_.*|request_analytics_summary_v1$|deleted_request_audit_v4$|department_request_notifications_v1$|pharmacy_.*|inventory_.*|inventory_name_merge_history$|manual_medicine_merge_history_v1$|similar_medicine_separations_v1$|custom_categories$|facility_logo$|hidden_request_categories_v1$|global_request_freeze_v2$|medication_(visibility|freeze)_rules_v3$|theme$)/.test(value);
  }
  if (role === 'pharmacy_staff') {
    return /^(crash_carts$|crash_cart_reports$|accountability_.*|requests$|notes$|dept_notes$|request_analytics_summary_v1$|theme$)/.test(value);
  }
  if (role === 'outpatient_pharmacy_supervisor') {
    return /^(crash_carts$|crash_cart_reports$|requests$|notes$|dept_notes$|request_analytics_summary_v1$|theme$)/.test(value);
  }
  if (role === 'controlled_pharmacy') {
    // The export-grant record is master-only: a role that could write it could
    // mint its own permission to export the controlled ledger.
    if (value === 'controlled_export_grants_v1') return false;
    return /^(controlled_.*|accountability_.*|psychotropic_.*|narcotic_.*|theme$)/.test(value);
  }
  if (role === 'warehouse') {
    // The ledger is one document per Hijri month; the warehouse records transfers
    // into it, so the month partitions are writable as the single document was.
    return /^(controlled_warehouse$|controlled_moves$|controlled_pdf_receipts$|theme$)/.test(value);
  }
  if (role === 'department') {
    const deptId = String(user.deptId || user.departmentId || '');
    const ownSnapshotPrefix = deptId ? `inventory_snapshot_${deptId}_` : '';
    // crash_cart_reports is intentionally absent: departments submit via the
    // submitCrashCartReport callable, which also updates crash_carts atomically.
    // firestore.rules denies the direct write, so allowing it here only produced
    // a permission error after the UI had already offered the action.
    // accountability_usage_v2 is absent for the same reason: submit and cancel go
    // through the accountabilityMutation callable so the balance check and the
    // transactional append are enforced server-side.
    return value === 'requests' || value === 'dept_notes' || value === 'notes' ||
      value === 'accountability_receipts_v2' ||
      value === 'accountability_expiry_batches_v1' || value === 'accountability_plan_usage_v1' ||
      (!!deptId && (value === `meds_${deptId}` || value === `expiry_${deptId}` || value === `shelves_${deptId}` ||
        value === `alerts_${deptId}` ||
        value === `inventory_integrity_${deptId}` || value === `inventory_snapshot_index_${deptId}` ||
        value.startsWith(ownSnapshotPrefix) ||
        (user.controlledCustodian === true && (value === `controlled_dept_list_${deptId}` || value === `controlled_dept_shelves_${deptId}` || value === `controlled_settings_${deptId}`))));
  }
  return false;
}
export function canDeleteStateKey(profile, key) {
  const user = profile || {};
  const role = normalizeRole(user.role);
  const value = baseStateKey(key);
  const master = user.master === true;
  if (master || role === 'pharmacy') return true;
  if (role === 'inpatient_supervisor' && /^inventory_snapshot_.*$/.test(value)) return true;
  if (role === 'department') {
    const deptId = String(user.deptId || user.departmentId || '');
    return !!deptId && value.startsWith(`inventory_snapshot_${deptId}_`);
  }
  return false;
}
