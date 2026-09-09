/* Who the session becomes while a Master is testing another role.

   The rules here are small and easy to state, and each one had already gone
   wrong somewhere in this file's history:

     the ACTUAL master keeps the identity. id, uid, the authenticated email —
     a test session is still that person acting, and the audit trail has to say
     so. Only the role and department are borrowed.

     master is false. Test mode exists to see what a pharmacy staff member sees,
     which is worthless if the session keeps master rights while pretending not
     to have them.

     the note is not a user. MASTER_EFFECTIVE carries five fields describing the
     test — mode, tested user, email, role, department. Six call sites read
     identity off it and saw a "user" with no id and no username; they go through
     fsEffectiveUser() now, and this file is where the two stay distinct.

   Extracted from modules/51 (2,234 lines) as the first slice of splitting it:
   pure, so the invariants above are provable without a browser, a login, or a
   Firestore. The modal, the audit entry and the restart stay with the module
   that owns the screen. */

export const DEPARTMENT_SCOPED_ROLES = Object.freeze(['department', 'outpatient_pharmacy_supervisor']);

function text(value, fallback) {
  const trimmed = String(value == null ? '' : value).trim();
  return trimmed || fallback || '';
}

/* actual   : the signed-in Master, as CU was at login
   profile  : the user (or role stand-in) being tested
   meta     : { mode: 'user' | 'role' }
   deptName : the department's display name, resolved by the caller

   Returns { user, testMode } — what CU becomes, and the note describing the
   test. Throws when the choice cannot make a session. */
export function buildTestSession({ actual, profile, meta, deptName } = {}) {
  if (!actual) throw new Error('Actual Master profile is unavailable.');
  const source = profile || {};
  const role = text(source.role, '');
  if (!role) throw new Error('Choose a role to test.');
  const deptId = text(source.deptId || source.departmentId, '');
  if (DEPARTMENT_SCOPED_ROLES.includes(role) && !deptId) {
    throw new Error('A department is required for this role.');
  }

  const testedUserId = source.id || source.uid || (meta && meta.testedUserId) || `role:${role}`;
  const testMode = {
    mode: (meta && meta.mode) || 'user',
    testedUserId,
    email: source.email || source.username || source.displayName || '',
    role,
    deptId: deptId || null,
    deptName: deptId ? text(deptName, '') : '',
  };

  const user = Object.assign({}, source, {
    // The person is unchanged; only what they are acting as changes.
    id: actual.id || actual.uid,
    uid: actual.uid || actual.id,
    authUid: actual.uid || actual.id,
    actualUserId: actual.id || actual.uid,
    actualEmail: actual.email || '',
    testedUserId,
    role,
    master: false,
    deptId: deptId || null,
    departmentId: deptId || null,
    deptName: deptId ? text(deptName, '') : '',
    username: source.username || source.displayName || source.email || role,
  });

  return { user, testMode };
}

/* Leaving test mode: the Master returns exactly as they signed in. */
export function restoreActualSession(actual) {
  if (!actual) throw new Error('Master profile is unavailable.');
  return Object.assign({}, actual);
}

/* True when this session is a Master pretending to be someone else — which is
   never the same question as "is this a Master". */
export function isTestingAnotherRole(testMode) {
  return !!(testMode && testMode.role);
}

Object.assign(globalThis, { buildTestSession, restoreActualSession, isTestingAnotherRole });
