export const DEPARTMENT_ID = 'dept-a';

// Every floorstock_state key currently referenced by the R6.66 application.
// Dynamic key families use DEPARTMENT_ID (or a stable sample suffix) so the
// rules tests cover both matching and cross-department denial.
export const APPLICATION_STATE_KEYS = [
  'accountability_assignments_v2',
  'accountability_receipts_v2',
  'accountability_regimens_v2',
  'accountability_regimen_catalog_v1',
  'accountability_regimens_v3',
  'accountability_usage_v2',
  `alerts_${DEPARTMENT_ID}`,
  'audit_log',
  'controlled_alert_days',
  'controlled_catalog',
  'controlled_department_seed_v2',
  `controlled_dept_list_${DEPARTMENT_ID}`,
  `controlled_dept_shelves_${DEPARTMENT_ID}`,
  'controlled_global_settings',
  'controlled_moves',
  'controlled_pdf_receipts',
  'controlled_pharmacy_stock',
  'controlled_pharmacy_storage_v1',
  'controlled_print_logo',
  `controlled_settings_${DEPARTMENT_ID}`,
  'controlled_warehouse',
  'crash_cart_medication_names_v1',
  'crash_cart_reports',
  'crash_carts',
  'deleted_request_audit_v4',
  'department_request_notifications_v1',
  'custom_categories',
  'daily_limits_v2',
  'deleted_departments',
  'departments',
  'dept_notes',
  'disp_slots',
  `expiry_${DEPARTMENT_ID}`,
  'facility_logo',
  'global_request_freeze_v2',
  'fulfillment_edit_settings_v1',
  'hidden_request_categories_v1',
  `inventory_integrity_${DEPARTMENT_ID}`,
  'inventory_name_merge_history',
  `inventory_snapshot_index_${DEPARTMENT_ID}`,
  `inventory_snapshot_${DEPARTMENT_ID}_sample_meds`,
  'manual_medicine_merge_history_v1',
  'medication_freeze_rules_v3',
  'medication_visibility_rules_v3',
  `meds_${DEPARTMENT_ID}`,
  'migration_crash_cart_norepinephrine_v3',
  'monthly_limits',
  'notes',
  'pharmacy_category_config',
  'pharmacy_department_announcements',
  'pharmacy_department_expiry_rules',
  'psychotropic_pharmacy_stock_import_r664_20260728_v2_safe_psych_only',
  'rate_limits_v2',
  'req_windows',
  'request_analytics_archive',
  'request_count_limits_v1',
  'request_hour_grids_v1',
  'requests',
  `shelves_${DEPARTMENT_ID}`,
  'similar_medicine_separations_v1',
  'theme',
  'weekly_limits_v2'
];

export function mayWriteState(role, key) {
  if (key === 'fulfillment_edit_settings_v1') return role === 'master';
  if (role === 'master' || role === 'pharmacy') return true;
  if (key === 'theme' || key === 'audit_log') return true;
  if (role === 'inpatient_supervisor') {
    return /^(crash_.*|accountability_.*|requests|notes|dept_notes|meds_.*|expiry_.*|shelves_.*|alerts_.*|request_analytics_archive|deleted_request_audit_v4|department_request_notifications_v1|pharmacy_.*|inventory_.*|inventory_name_merge_history|manual_medicine_merge_history_v1|similar_medicine_separations_v1|custom_categories|facility_logo|hidden_request_categories_v1|global_request_freeze_v2|medication_(visibility|freeze)_rules_v3|audit_log|theme)$/.test(key);
  }
  if (role === 'pharmacy_staff') {
    return /^(crash_carts|crash_cart_reports|accountability_.*|requests|notes|dept_notes|request_analytics_archive|audit_log|theme)$/.test(key);
  }
  if (role === 'outpatient_pharmacy_supervisor') {
    return /^(crash_carts|crash_cart_reports|requests|notes|dept_notes|request_analytics_archive|audit_log|theme)$/.test(key);
  }
  if (role === 'controlled_pharmacy') {
    return /^(controlled_.*|accountability_.*|audit_log|theme)$/.test(key);
  }
  if (role === 'warehouse') {
    return /^(controlled_warehouse|controlled_moves|controlled_pdf_receipts|audit_log|theme)$/.test(key);
  }
  if (role === 'department' || role === 'custodian') {
    const allowed = new Set([
      'requests', 'dept_notes', 'notes', 'crash_cart_reports',
      'accountability_usage_v2', 'accountability_receipts_v2',
      'audit_log', 'theme', `meds_${DEPARTMENT_ID}`, `expiry_${DEPARTMENT_ID}`, `shelves_${DEPARTMENT_ID}`,
      `inventory_integrity_${DEPARTMENT_ID}`, `inventory_snapshot_index_${DEPARTMENT_ID}`,
      `inventory_snapshot_${DEPARTMENT_ID}_sample_meds`
    ]);
    if (role === 'custodian') {
      allowed.add(`controlled_dept_list_${DEPARTMENT_ID}`);
      allowed.add(`controlled_dept_shelves_${DEPARTMENT_ID}`);
      allowed.add(`controlled_settings_${DEPARTMENT_ID}`);
    }
    return allowed.has(key);
  }
  return false;
}
