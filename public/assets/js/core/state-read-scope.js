/* Which state documents each role reads at sign-in.

   This list is the difference between a ward opening the app and seeing its
   inventory, and a ward opening the app and seeing nothing. A scoped role cannot
   LIST the collection — the security rules forbid it — so it has to name every
   document it will read. A key missing from this list is a blank screen with no
   error; a key that a role may not read is a permission error on every login.

   The Master returns null, which means "read the whole collection": the Master
   is the only profile allowed to list it.

   Month-partitioned keys are appended at read time rather than frozen at deploy,
   so the list follows the calendar. Each key states its own session window in its
   registration — orders are read constantly and a department's working view is a
   few weeks, while the custody officer's is a year.

   Lifted out of modules/03 with its key lists passed in, so the rules can be
   tested without the Firebase graph behind them. */

export function isPharmacyScopedProfile(profile) {
  return !!profile && [
    'inpatient_supervisor', 'inpatient_pharmacy_supervisor', 'inpatient pharmacy supervisor', 'pharmacy_staff',
  ].includes(String(profile.role || ''));
}

/* A key named twice — once in a role's static list, once as a partitioned base
   key — is read once. Every duplicate is a paid Firestore read for nothing. */
export function uniqueKeys(keys) {
  const seen = {};
  return (keys || []).filter((key) => {
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

/* The per-department documents a department account reads. The prefixes are its
   own inventory; the controlled list and the print signatures are readable by
   EVERY department, not only a custodian — gating the signatures behind the
   custodian flag left them blank on other departments' custody printouts. */
export function departmentKeysFor(profile) {
  const deptId = String((profile && (profile.deptId || profile.departmentId)) || '').trim();
  if (!deptId) return [];
  const keys = ['meds_', 'expiry_', 'shelves_', 'alerts_', 'inventory_integrity_', 'inventory_snapshot_index_']
    .map((prefix) => prefix + deptId);
  keys.push('controlled_dept_list_' + deptId, 'controlled_settings_' + deptId);
  if (profile && profile.controlledCustodian === true) keys.push('controlled_dept_shelves_' + deptId);
  return keys;
}

export function stateKeysForProfile(profile, lists = {}) {
  const {
    pharmacyScoped = [], controlledPharmacyBase = [], warehouse = [], departmentShared = [],
    auditKeys = () => [], ledgerKeys = () => [], ledgerMonths = 12,
  } = lists;

  if (!profile) return null;
  /* Only the Master may list the collection. */
  if (profile.master === true) return null;

  const role = String(profile.role || '');
  if (isPharmacyScopedProfile(profile)) {
    return uniqueKeys(pharmacyScoped.concat(ledgerKeys(ledgerMonths)));
  }
  if (role === 'controlled_pharmacy') {
    return uniqueKeys(controlledPharmacyBase.concat(auditKeys(1), ledgerKeys(ledgerMonths)));
  }
  if (role === 'warehouse') {
    return uniqueKeys(warehouse.concat(auditKeys(1), ledgerKeys(ledgerMonths)));
  }
  /* Any other role is not scoped by this list at all. */
  if (!['department', 'outpatient_pharmacy_supervisor'].includes(role)) return null;

  return uniqueKeys(departmentShared.concat(ledgerKeys(ledgerMonths), departmentKeysFor(profile)));
}
