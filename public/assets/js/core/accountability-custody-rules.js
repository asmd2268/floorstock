/* What a department may still submit against its custody, and which treatment
   plan is stopping it.

   The balance itself is decided server-side, inside a transaction, and always
   re-checked there — a client cannot talk its way past it. These are the rules
   the SCREEN needs so it can refuse an impossible submission before the person
   fills the form in:

   Units already submitted and awaiting pharmacy review are spoken for. A
   department that asked for eight and is waiting on them cannot ask for eight
   more against the same balance and discover only afterwards that half of it
   was never available.

   A treatment plan that has been paused blocks submissions against every
   assignment it covers — but only the ACTIVE version of that plan, since older
   versions are kept as history and must not go on blocking anything.

   Lifted out of modules/50 as one-liners with no test. */

const PENDING = 'pending_pharmacy';

function units(value) { const n = Number(value); return Math.max(0, Number.isFinite(n) ? n : 0); }

export function pendingUnits(usage, assignmentId) {
  return (Array.isArray(usage) ? usage : [])
    .filter((row) => String(row.assignmentId) === String(assignmentId) && row.status === PENDING)
    .reduce((sum, row) => sum + units(row.units), 0);
}

/* Never below zero: a balance that has somehow been over-committed is shown as
   nothing left, not as a negative amount a department might read as credit. */
export function effectiveBalance(assignment, usage) {
  return Math.max(0, units(assignment && assignment.balance) - pendingUnits(usage, assignment && assignment.id));
}

/* The version in force. An assignment removed from the plan's current version
   is no longer covered by it, whatever older versions said. */
export function activeRegimenVersion(regimen) {
  if (!regimen) return null;
  const versions = regimen.versions || [];
  return versions.find((version) => String(version.id) === String(regimen.activeVersionId)) || versions[0] || null;
}

export function regimensForAssignment(regimens, deptId, assignmentId) {
  return (Array.isArray(regimens) ? regimens : []).filter((regimen) => {
    if (regimen.active === false || String(regimen.deptId) !== String(deptId)) return false;
    const version = activeRegimenVersion(regimen);
    return !!(version && (version.items || []).some((item) => String(item.assignmentId) === String(assignmentId)));
  });
}

export function submissionBlockedBy(regimens, deptId, assignmentId) {
  return regimensForAssignment(regimens, deptId, assignmentId).find((regimen) => regimen.paused === true) || null;
}

/* The reason lines typed on a custody record: trimmed, blanks dropped, and the
   same reason typed twice kept once — folded the way medicine names are folded
   elsewhere, so spacing and case do not create a second "reason". */
export function uniqueLines(value, normalize = (v) => String(v || '').toLowerCase().trim()) {
  const seen = {};
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).filter((line) => {
    const key = normalize(line);
    if (!key || seen[key]) return false;
    seen[key] = 1;
    return true;
  });
}

export function filterUsageRows(rows, filters = {}, assignmentOf = () => ({}), normalize = (v) => String(v || '').toLowerCase().trim()) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const assignment = assignmentOf(row.assignmentId) || {};
    if (filters.dept && String(row.deptId) !== String(filters.dept)) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.medicine && normalize(assignment.medName || row.medName).indexOf(normalize(filters.medicine)) < 0) return false;
    return true;
  });
}
