/* The document keys a scoped role asks for, built from state it already holds.
   These were three functions inside the state/auth module; they take plain values
   and return a list of keys, so they live here where they can be tested without
   Firebase, a session or a clock. */

/* "audit_log_YYYY-MM" for the current month and `monthsBack` months before it. A
   role that cannot LIST the collection has to name the months it wants. */
export function recentAuditLogKeys(monthsBack, now) {
  const keys = [];
  const base = now || new Date();
  for (let i = 0; i <= (monthsBack || 1); i += 1) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    keys.push('audit_log_' + d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'));
  }
  return keys;
}

function departmentIds(cache) {
  return (Array.isArray(cache && cache.departments) ? cache.departments : [])
    .map((dept) => String((dept && dept.id) || '').trim())
    .filter(Boolean);
}

/* controlled_settings_ (custody print signatures and print-code mode) and
   controlled_dept_shelves_ (shelf and cabinet layout) are readable and writable by
   the controlled-pharmacy role for every department. They once went missing from
   the scoped list, so a save succeeded in Firestore and never came back on the next
   load, and edits seemed to revert. The three keys per department belong together. */
export function controlledPharmacyDeptKeys(cache) {
  const keys = [];
  departmentIds(cache).forEach((id) => {
    keys.push('controlled_dept_list_' + id, 'controlled_settings_' + id, 'controlled_dept_shelves_' + id);
  });
  return keys;
}

const PHARMACY_DEPARTMENT_PREFIXES = Object.freeze(['meds_', 'expiry_', 'shelves_', 'alerts_', 'inventory_integrity_', 'inventory_snapshot_index_']);

/* The per-department keys a pharmacy role reads, one set for every department in
   `cache.departments`. */
export function pharmacyDepartmentStateKeys(cache) {
  const keys = [];
  departmentIds(cache).forEach((id) => {
    PHARMACY_DEPARTMENT_PREFIXES.forEach((prefix) => keys.push(prefix + id));
  });
  return keys;
}
