'use strict';

const crypto = require('crypto');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getAppCheck } = require('firebase-admin/app-check');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { canCreateHandover, createToken, hashToken, tokenMatches, cleanIdentity, number, applyPartyConfirmation, completeHandoverState } = require('./accountability-handover-core');

initializeApp();
const db = getFirestore();
const auth = getAuth();
const appCheck = getAppCheck();

// Monitoring-only for now, matching the same cautious rollout as the rest of
// the app's App Check integration this session: logs whether a request to
// these two previously-unprotected public HTTP endpoints carried a valid
// App Check token, but never rejects on a missing/invalid one yet. Flip to
// enforcing (return false / have callers reject) only after confirming a
// healthy verified rate in real traffic — the client only started sending
// this header now, so there is no baseline yet.
async function logAppCheckStatus(request, label) {
  const headerToken = request.get('X-Firebase-AppCheck');
  if (!headerToken) {
    console.warn(`[app-check] ${label}: no token present`);
    return;
  }
  try {
    await appCheck.verifyToken(headerToken);
    console.info(`[app-check] ${label}: verified`);
  } catch (error) {
    console.warn(`[app-check] ${label}: invalid token`, error.message || error);
  }
}
const CALLABLE_OPTIONS = {
  region: 'us-central1',
  // Keep monitoring-only until every supported production client is observed
  // sending valid App Check tokens, then deploy with ENFORCE_APP_CHECK=true.
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true'
};

// Keep this list synchronized with the role selector and login validation in R6.65.
const ALLOWED_ROLES = new Set([
  'pharmacy',
  'pharmacy_director',
  'pharmacy_staff',
  'outpatient_pharmacy_supervisor',
  'inpatient_supervisor',
  'department',
  'custodian',
  'warehouse',
  'controlled_pharmacy'
]);
const SAAS_PLANS = Object.freeze({
  starter: ['inventory', 'requests', 'expiry', 'printing'],
  professional: ['inventory', 'requests', 'expiry', 'printing', 'analytics', 'crash_cart', 'controlled', 'labels'],
  enterprise: ['inventory', 'requests', 'expiry', 'printing', 'analytics', 'crash_cart', 'controlled', 'labels', 'warehouse', 'branding']
});
const SAAS_LIMITS = Object.freeze({
  starter: { maxUsers: 25, maxDepartments: 10 },
  professional: { maxUsers: 100, maxDepartments: 50 },
  enterprise: { maxUsers: null, maxDepartments: null }
});
const SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due', 'canceled']);

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function legacyProfileMatches(identity, candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  const uid = String(identity.uid || '');
  const email = cleanEmail(identity.email);
  return (uid && String(candidate.id || candidate.uid || '') === uid)
    || (email && cleanEmail(candidate.email) === email);
}

async function legacyCallerProfile(identity) {
  // Legacy installations keep their directory in one state document.  This
  // compatibility lookup is deliberately server-side: it lets an existing
  // authenticated administrator use the new callable API without weakening
  // client Firestore permissions.
  const snap = await stateRef('users').get();
  return stateArray(snap).find((row) => legacyProfileMatches(identity, row)) || null;
}

async function callerProfile(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const ref = db.collection('users').doc(request.auth.uid);
  const snap = await ref.get();
  let profile = snap.exists ? snap.data() : null;
  if (!profile) {
    const legacy = await legacyCallerProfile(request.auth);
    if (!legacy) throw new HttpsError('permission-denied', 'User profile not found.');
    // Migrate only the caller on their first authenticated operation.  The
    // original legacy directory is left untouched as a read-only fallback,
    // so this cannot delete accounts or lose historical data.
    profile = {
      ...legacy,
      id: request.auth.uid,
      email: cleanEmail(legacy.email || request.auth.token.email),
      active: legacy.active !== false,
      tenantId: legacy.tenantId || null,
      migratedFromLegacyDirectoryAt: FieldValue.serverTimestamp()
    };
    await ref.set(profile, { merge: true });
  }
  if (profile.active === false) throw new HttpsError('permission-denied', 'Account is inactive.');
  return { uid: request.auth.uid, ...profile };
}

function requirePharmacy(profile) {
  // Master accounts are the platform's pharmacy administrators. Older
  // profiles use role="master" while newer profiles use role="pharmacy"
  // with master=true; both must be accepted by managed-user callables.
  if (profile.master !== true && !['master', 'pharmacy', 'pharmacy_director'].includes(profile.role)) {
    throw new HttpsError('permission-denied', 'Only a pharmacy manager can perform this action.');
  }
}

function requireMaster(profile) {
  requirePharmacy(profile);
  if (profile.master !== true) {
    throw new HttpsError('permission-denied', 'Master access is required.');
  }
}

function isPlatformAdmin(request, profile) {
  return request.auth?.token?.platformAdmin === true || (profile.master === true && !profile.tenantId);
}

function requirePlatformAdmin(request, profile) {
  if (!isPlatformAdmin(request, profile)) throw new HttpsError('permission-denied', 'Platform administrator access is required.');
}

function requireSameTenant(caller, target) {
  if (String(caller.tenantId || '') !== String(target.tenantId || '')) {
    throw new HttpsError('permission-denied', 'The user belongs to another organization.');
  }
}

function subscriptionWritable(tenant) {
  if (!tenant || !['active', 'trialing'].includes(String(tenant.status || ''))) return false;
  const end = tenant.currentPeriodEnd || tenant.trialEndsAt;
  return !end || end.toMillis() > Date.now();
}

async function tenantSubscription(profile) {
  if (!profile.tenantId) return null;
  const snap = await db.collection('tenants').doc(String(profile.tenantId)).get();
  if (!snap.exists) throw new HttpsError('failed-precondition', 'Organization subscription was not found.');
  return { id: snap.id, ...snap.data() };
}

async function requireWritableSubscription(profile) {
  const tenant = await tenantSubscription(profile);
  if (tenant && !subscriptionWritable(tenant)) {
    throw new HttpsError('failed-precondition', 'The subscription is read-only. Renew it before making changes.');
  }
  return tenant;
}

async function audit(action, actor, targetUid, details = {}) {
  await db.collection('audit_logs').add({
    action,
    actorUid: actor.uid,
    actorEmail: actor.email || null,
    targetUid: targetUid || null,
    details,
    createdAt: FieldValue.serverTimestamp()
  });
}

async function countActiveMasters(excludeUid = null, tenantId = '') {
  const query = tenantId
    ? db.collection('users').where('tenantId', '==', tenantId)
    : db.collection('users').where('master', '==', true);
  const snap = await query.get();
  return snap.docs.filter((doc) => {
    const user = doc.data();
    return doc.id !== excludeUid && user.active !== false && ['pharmacy', 'pharmacy_director'].includes(user.role) && user.master === true;
  }).length;
}

// Geo-gate for state writes (see fsStateSetSmart/fsStateDeleteSmart in
// 03-core-application-firebase-state-auth.js). Read-only check, never
// performs the write itself.
//
// Confirmed via a real request (see [GEO-DEBUG] logs, now removed) that
// Cloud Functions v2 / Cloud Run never populates x-appengine-country or
// x-vercel-ip-country — this project's requests reach the function
// directly, not through Vercel's edge or App Engine. The only usable
// location signal present is the raw client IP (x-forwarded-for), so the
// country is resolved via ipapi.co's free IP-lookup endpoint instead.
// Fail-open throughout: no IP, a non-OK response, or any network error
// (including the 3s timeout) all return allowed:true rather than block
// writes nationwide over a third-party lookup outage.
exports.checkGeoAllowed = onCall(CALLABLE_OPTIONS, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in first / يجب تسجيل الدخول');
  }
  const headers = (request.rawRequest && request.rawRequest.headers) || {};
  const clientIp = (headers['x-forwarded-for'] || '').split(',')[0].trim();

  if (!clientIp) {
    console.warn('[geo-check] No client IP found in headers — failing open');
    return { allowed: true, country: 'ip-missing' };
  }

  try {
    const response = await fetch(`https://ipapi.co/${clientIp}/country/`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      console.warn('[geo-check] ipapi.co returned non-OK status:', response.status);
      return { allowed: true, country: 'lookup-failed' };
    }

    const country = (await response.text()).trim();
    const allowed = country === 'SA';

    console.info(`[geo-check] IP ${clientIp} → country ${country} → allowed: ${allowed}`);
    return { allowed, country };
  } catch (error) {
    console.error('[geo-check] ipapi.co lookup failed:', error.message);
    return { allowed: true, country: 'lookup-error' };
  }
});

exports.listManagedUsers = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requirePharmacy(caller);
  const tenantId = String(caller.tenantId || '');
  const snap = tenantId
    ? await db.collection('users').where('tenantId', '==', tenantId).get()
    : await db.collection('users').get();
  const currentUsers = snap.docs
    .filter((doc) => tenantId ? doc.data().tenantId === tenantId : !doc.data().tenantId)
    .map((doc) => ({ id: doc.id, ...doc.data() }));

  // Before managed profiles moved to /users, legacy installations stored the
  // directory in floorstock_state/users (or tenants/{id}/state/users).  Keep
  // that directory readable during the transition: existing user profiles win
  // and legacy rows only fill gaps.  This is read-only and never creates or
  // changes an Authentication account.
  const legacySnap = await stateRef('users', tenantId).get();
  const knownIds = new Set(currentUsers.map((user) => String(user.id || '').trim()).filter(Boolean));
  const knownEmails = new Set(currentUsers.map((user) => cleanEmail(user.email)).filter(Boolean));
  const legacyUsers = stateArray(legacySnap).filter((user) => {
    const id = String(user && user.id || '').trim();
    const email = cleanEmail(user && user.email);
    // A migrated caller receives a Firebase UID but keeps its legacy email.
    // Do not show one account twice in the managed-user directory.
    if (!id || knownIds.has(id) || (email && knownEmails.has(email))) return false;
    if (tenantId && String(user && user.tenantId || '') !== tenantId) return false;
    return true;
  }).map((user) => ({
    ...user,
    id: String(user.id),
    tenantId: tenantId || null,
    legacyDirectory: true
  }));
  return { users: currentUsers.concat(legacyUsers), legacyCount: legacyUsers.length };
});

exports.createManagedUser = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requirePharmacy(caller);
  const tenant = await requireWritableSubscription(caller);

  const data = request.data || {};
  const email = cleanEmail(data.email);
  const password = String(data.password || '');
  const requestedRole = String(data.role || '');
  const deptId = data.deptId ? String(data.deptId) : null;
  const grantMaster = data.master === true;

  if (!email || !email.includes('@')) throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  if (password.length < 8) throw new HttpsError('invalid-argument', 'Password must be at least 8 characters.');
  if (!ALLOWED_ROLES.has(requestedRole)) throw new HttpsError('invalid-argument', 'Invalid role.');
  if ((requestedRole === 'department' || requestedRole === 'custodian' || requestedRole === 'outpatient_pharmacy_supervisor') && !deptId) {
    throw new HttpsError('invalid-argument', 'Department is required for this role.');
  }
  if (requestedRole === 'outpatient_pharmacy_supervisor') {
    const departmentsSnap = await stateRef('departments', caller.tenantId || '').get();
    const departments = stateArray(departmentsSnap);
    const selected = departments.find((row) => String(row.id) === deptId);
    const isOutpatient = selected && (/outpatient\s+department/i.test(String(selected.name || selected.nameEn || '')) || String(selected.id || '').toLowerCase() === 'outpatient');
    if (!isOutpatient) throw new HttpsError('invalid-argument', 'Outpatient Pharmacy Supervisor must be assigned to OUTPATIENT DEPARTMENT.');
  }
  if (grantMaster && (caller.master !== true || !['pharmacy', 'pharmacy_director'].includes(requestedRole))) {
    throw new HttpsError('permission-denied', 'Only a Master may grant Master access to a pharmacy user.');
  }
  if (tenant) {
    if (requestedRole === 'warehouse' && !tenant.features.includes('warehouse')) {
      throw new HttpsError('failed-precondition', 'Warehouse access is not included in this plan.');
    }
    if (['controlled_pharmacy', 'custodian'].includes(requestedRole) && !tenant.features.includes('controlled')) {
      throw new HttpsError('failed-precondition', 'Controlled-medicine access is not included in this plan.');
    }
    const limit = (SAAS_LIMITS[tenant.plan] || SAAS_LIMITS.starter).maxUsers;
    if (limit !== null) {
      const users = await db.collection('users').where('tenantId', '==', tenant.id).get();
      if (users.size >= limit) throw new HttpsError('resource-exhausted', `This plan allows up to ${limit} users.`);
    }
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, emailVerified: false, disabled: false });
    const profile = {
      id: userRecord.uid,
      email,
      displayName: email,
      role: requestedRole === 'custodian' ? 'department' : requestedRole,
      deptId: (requestedRole === 'department' || requestedRole === 'custodian' || requestedRole === 'outpatient_pharmacy_supervisor') ? deptId : null,
      controlledCustodian: requestedRole === 'custodian',
      active: true,
      master: grantMaster,
      tenantId: caller.tenantId || null,
      tenantName: caller.tenantName || null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: caller.uid
    };
    await db.collection('users').doc(userRecord.uid).set(profile);
    await audit('user.create', caller, userRecord.uid, {
      email,
      role: requestedRole,
      deptId,
      master: grantMaster
    });
    return { user: { ...profile, createdAt: null } };
  } catch (error) {
    if (userRecord) await auth.deleteUser(userRecord.uid).catch(() => {});
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'This email already exists.');
    }
    console.error('createManagedUser failed', error);
    throw new HttpsError('internal', 'Could not create the user.');
  }
});

exports.deleteManagedUser = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requireMaster(caller);
  await requireWritableSubscription(caller);
  const uid = String((request.data || {}).uid || '');
  if (!uid) throw new HttpsError('invalid-argument', 'User ID is required.');
  if (uid === caller.uid) throw new HttpsError('failed-precondition', 'You cannot delete your own account.');

  const targetRef = db.collection('users').doc(uid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new HttpsError('not-found', 'User profile not found.');
  const target = targetSnap.data();
  requireSameTenant(caller, target);
  if (target.master === true && await countActiveMasters(uid, caller.tenantId || '') < 1) {
    throw new HttpsError('failed-precondition', 'You cannot delete the last active Master.');
  }

  await auth.deleteUser(uid).catch((error) => {
    if (error.code !== 'auth/user-not-found') throw error;
  });
  await targetRef.delete();
  await audit('user.delete', caller, uid, {
    email: target.email || null,
    role: target.role || null,
    master: target.master === true
  });
  return { ok: true };
});

exports.setMasterAccess = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requireMaster(caller);
  await requireWritableSubscription(caller);
  const uid = String((request.data || {}).uid || '');
  const master = (request.data || {}).master === true;
  if (!uid) throw new HttpsError('invalid-argument', 'User ID is required.');
  if (uid === caller.uid && !master) {
    throw new HttpsError('failed-precondition', 'You cannot remove your own Master access.');
  }

  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'User profile not found.');
  const target = snap.data();
  requireSameTenant(caller, target);
  if (!['pharmacy', 'pharmacy_director'].includes(target.role)) {
    throw new HttpsError('failed-precondition', 'Master access can only be assigned to a pharmacy user.');
  }
  if (!master && target.master === true && await countActiveMasters(uid, caller.tenantId || '') < 1) {
    throw new HttpsError('failed-precondition', 'You cannot remove the last active Master.');
  }

  await ref.update({ master, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid });
  await audit(master ? 'master.grant' : 'master.revoke', caller, uid, { email: target.email || null });
  return { ok: true, master };
});

exports.setDeptRestrictions = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requirePharmacy(caller);
  await requireWritableSubscription(caller);

  const uid = String((request.data || {}).uid || '');
  const rawBlocked = (request.data || {}).blockedDepts;
  if (!uid) throw new HttpsError('invalid-argument', 'User ID is required.');
  if (!Array.isArray(rawBlocked)) throw new HttpsError('invalid-argument', 'blockedDepts must be an array.');

  const blockedDepts = rawBlocked.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  if (blockedDepts.length > 200) throw new HttpsError('invalid-argument', 'Too many blocked departments.');

  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'User profile not found.');
  const target = snap.data();
  requireSameTenant(caller, target);

  const restrictableRoles = ['pharmacy_staff', 'inpatient_supervisor', 'inpatient_pharmacy_supervisor'];
  if (!restrictableRoles.includes(target.role)) {
    throw new HttpsError('failed-precondition', 'Department restrictions can only be set for pharmacy_staff or inpatient_supervisor users.');
  }

  const existingClaims = await auth.getUser(uid).then((u) => u.customClaims || {});
  const newClaims = { ...existingClaims };
  if (blockedDepts.length > 0) {
    newClaims.blockedDepts = blockedDepts;
  } else {
    delete newClaims.blockedDepts;
  }
  await auth.setCustomUserClaims(uid, newClaims);

  const updateData = { updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid };
  if (blockedDepts.length > 0) {
    updateData.blockedDepts = blockedDepts;
  } else {
    updateData.blockedDepts = FieldValue.delete();
  }
  await ref.update(updateData);

  // Also write to the tenant state doc so live sessions pick up the change
  // without requiring a re-login (state store syncs this in real-time).
  const restrictionsRef = stateRef('user_dept_restrictions_v1', caller.tenantId || '');
  const restrictionsSnap = await restrictionsRef.get();
  const restrictionsMap = (restrictionsSnap.exists && restrictionsSnap.data() && typeof restrictionsSnap.data().value === 'object' && !Array.isArray(restrictionsSnap.data().value))
    ? { ...restrictionsSnap.data().value }
    : {};
  if (blockedDepts.length > 0) {
    restrictionsMap[uid] = blockedDepts;
  } else {
    delete restrictionsMap[uid];
  }
  await restrictionsRef.set({ value: restrictionsMap, updatedAt: FieldValue.serverTimestamp() });

  await audit('user.dept_restrictions.set', caller, uid, {
    email: target.email || null,
    blockedDepts
  });
  return { ok: true, blockedDepts };
});

// Strong server-side enforcement for per-user department restrictions.
// pharmacy_staff and inpatient_supervisor write to accountability docs through
// this CF so blockedDepts from token claims can be validated before any mutation
// reaches Firestore (Admin SDK bypasses Firestore rules, so the check lives here).
exports.accountabilityMutation = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  const data = request.data || {};
  const action = String(data.action || '');
  /* Every accountability mutation runs through this callable, not only the roles
     that Firestore rules restrict. The direct client path wrote balance and status
     as two separate documents with no transaction, so two people deciding at once
     could lose one another's update; the transactions here remove that for
     pharmacy and master too. The per-action checks below are unchanged, so
     widening who may call this does not widen what any of them may do. */
  const restrictedRoles = new Set([
    'pharmacy_staff', 'inpatient_supervisor', 'inpatient_pharmacy_supervisor', 'inpatient pharmacy supervisor',
    'pharmacy', 'pharmacy_director', 'master'
  ]);
  const callerIsMaster = caller.master === true;
  // submitUsage is the department's own consumption entry. It is the one action
  // departments may call: writing accountability_usage_v2 straight from the
  // browser replaces the whole document, so two departments submitting at the
  // same moment silently lost one entry, and the balance check existed only in
  // client JS — a crafted direct write could exceed the custody balance. Both
  // are enforced here inside a transaction instead.
  const isDepartmentAction = (action === 'submitUsage' || action === 'cancelUsage') && caller.role === 'department';
  if (!isDepartmentAction && !restrictedRoles.has(caller.role) && !callerIsMaster) {
    throw new HttpsError('permission-denied', 'This role cannot perform accountability mutations.');
  }
  await requireWritableSubscription(caller);

  const tenantId = caller.tenantId || '';

  // Read blockedDepts from token claims (fast path) or Firestore profile
  // (fallback for the window between setDeptRestrictions and next token refresh).
  const tokenClaims = request.auth.token || {};
  let blockedDepts = Array.isArray(tokenClaims.blockedDepts)
    ? tokenClaims.blockedDepts.map((d) => String(d).trim().toLowerCase())
    : null;
  if (!blockedDepts) {
    const profileSnap = await db.collection('users').doc(request.auth.uid).get();
    const profileBlocked = profileSnap.exists ? (profileSnap.data().blockedDepts || []) : [];
    blockedDepts = profileBlocked.map((d) => String(d).trim().toLowerCase());
  }

  function isDeptBlocked(deptId) {
    return blockedDepts.includes(String(deptId || '').trim().toLowerCase());
  }

  const assignmentsRef = stateRef('accountability_assignments_v2', tenantId);
  const usageRef = stateRef('accountability_usage_v2', tenantId);

  if (action === 'submitUsage') {
    const callerDept = String(caller.deptId || caller.departmentId || '').trim();
    if (!callerDept) throw new HttpsError('failed-precondition', 'Your account is not linked to a department.');
    if (isDeptBlocked(callerDept)) {
      throw new HttpsError('permission-denied', 'Access to this department is restricted for your account.');
    }
    const assignmentId = String(data.assignmentId || '');
    const units = number(data.units);
    if (!assignmentId || !(units > 0)) {
      throw new HttpsError('invalid-argument', 'assignmentId and a positive units value are required.');
    }
    const consumptionDate = String(data.consumptionDate || '').trim();
    const patientFile = String(data.patientFile || '').trim().slice(0, 60);
    const doctor = String(data.doctor || '').trim().slice(0, 120);
    const reasonLabel = String(data.reasonLabel || '').trim().slice(0, 200);
    if (!consumptionDate || !patientFile || !doctor || !reasonLabel) {
      throw new HttpsError('invalid-argument', 'Consumption date, patient file, doctor and reason are required.');
    }
    if (consumptionDate > new Date().toISOString().slice(0, 10)) {
      throw new HttpsError('invalid-argument', 'Consumption date cannot be in the future.');
    }
    let created = null;
    await db.runTransaction(async (tx) => {
      const [assignSnap, usageSnap] = await Promise.all([tx.get(assignmentsRef), tx.get(usageRef)]);
      const assignments = stateArray(assignSnap);
      const a = assignments.find((x) => String(x.id) === String(assignmentId));
      if (!a || a.active === false) throw new HttpsError('failed-precondition', 'Custody is not available.');
      // The department may only spend against its own custody record.
      if (String(a.deptId) !== callerDept) throw new HttpsError('permission-denied', 'This custody belongs to another department.');
      const rows = stateArray(usageSnap);
      // Effective balance mirrors the client: recorded balance minus everything
      // already submitted and not yet decided, so concurrent submissions cannot
      // each pass against the same untouched balance.
      const pending = rows.reduce((sum, u) => (
        String(u.assignmentId) === String(assignmentId) && u.status === 'pending_pharmacy'
          ? sum + number(u.units)
          : sum
      ), 0);
      const effective = number(a.balance) - pending;
      if (units > effective) {
        throw new HttpsError('failed-precondition', `Used units exceed the available balance. Available: ${effective}`);
      }
      const now = new Date().toISOString();
      created = {
        id: `acc2u_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`,
        assignmentId,
        // deptId/medName come from the custody record and session, never the client.
        deptId: a.deptId,
        medName: a.medName || '',
        units,
        doseAmount: data.doseAmount == null ? null : number(data.doseAmount),
        doseUnit: data.doseUnit == null ? null : String(data.doseUnit).slice(0, 40),
        weightKg: data.weightKg == null ? null : number(data.weightKg),
        pregnancyStatus: data.pregnancyStatus == null ? null : String(data.pregnancyStatus).slice(0, 40),
        patientAge: data.patientAge == null ? null : number(data.patientAge),
        consumptionDate,
        patientFile,
        doctor,
        reasonLabel,
        note: String(data.note || '').trim().slice(0, 500),
        status: 'pending_pharmacy',
        submittedAt: now,
        submittedBy: caller.name || caller.email || '',
        submittedByUser: caller.email || '',
        locked: false
      };
      writeState(tx, usageRef, rows.concat([created]));
    });
    // Returned so the caller can mirror the committed row into its local cache
    // immediately instead of waiting for the listener round trip.
    return { ok: true, id: created && created.id, row: created };
  }

  if (action === 'cancelUsage') {
    const callerDept = String(caller.deptId || caller.departmentId || '').trim();
    if (!callerDept) throw new HttpsError('failed-precondition', 'Your account is not linked to a department.');
    const id = String(data.id || '');
    if (!id) throw new HttpsError('invalid-argument', 'id is required.');
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(usageRef);
      const rows = stateArray(snap);
      const u = rows.find((x) => String(x.id) === String(id));
      if (!u) throw new HttpsError('not-found', 'This submission no longer exists.');
      // Only the owning department, and only before pharmacy has acted on it.
      if (String(u.deptId) !== callerDept) throw new HttpsError('permission-denied', 'This submission belongs to another department.');
      if (u.status !== 'pending_pharmacy' && u.status !== 'rejected') {
        throw new HttpsError('failed-precondition', 'This submission can no longer be modified.');
      }
      writeState(tx, usageRef, rows.filter((x) => String(x.id) !== String(id)));
    });
    return { ok: true };
  }

  if (action === 'saveAssignment') {
    const { id, deptId, medName, quota, reasons, active, expiryDate, itemDetails } = data;
    if (!deptId || !medName || !(Number(quota) > 0) || !Array.isArray(reasons) || !reasons.length) {
      throw new HttpsError('invalid-argument', 'Department, medicine, positive quota, and at least one reason are required.');
    }
    if (isDeptBlocked(deptId)) {
      throw new HttpsError('permission-denied', 'Access to this department is restricted for your account.');
    }
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(assignmentsRef);
      const list = stateArray(snap).map((x) => ({ ...x }));
      const now = new Date().toISOString();
      const actorName = caller.name || caller.email || '';
      const existing = list.find((x) => String(x.id) === String(id || ''));
      if (existing) {
        const deficit = Math.max(0, Number(existing.quota) - Number(existing.balance));
        existing.deptId = deptId;
        existing.medName = medName;
        existing.quota = Number(quota);
        existing.balance = Math.max(0, Math.min(Number(quota), Number(quota) - deficit));
        existing.reasons = reasons;
        existing.active = active !== false;
        existing.expiryDate = expiryDate || '';
        existing.itemDetails = Array.isArray(itemDetails) ? itemDetails : [];
        existing.updatedAt = now;
        existing.updatedBy = actorName;
      } else {
        list.push({
          id: `acc2a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          deptId, medName, quota: Number(quota), balance: Number(quota),
          reasons, active: active !== false,
          expiryDate: expiryDate || '', itemDetails: Array.isArray(itemDetails) ? itemDetails : [],
          createdAt: now, createdBy: actorName,
          updatedAt: now, updatedBy: actorName
        });
      }
      writeState(tx, assignmentsRef, list);
    });
    return { ok: true };
  }

  if (action === 'toggleAssignment') {
    const { id } = data;
    if (!id) throw new HttpsError('invalid-argument', 'id is required.');
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(assignmentsRef);
      const list = stateArray(snap).map((x) => ({ ...x }));
      const row = list.find((x) => String(x.id) === String(id));
      if (!row) throw new HttpsError('not-found', 'Assignment not found.');
      if (isDeptBlocked(row.deptId)) {
        throw new HttpsError('permission-denied', 'Access to this department is restricted for your account.');
      }
      row.active = row.active === false;
      row.updatedAt = new Date().toISOString();
      row.updatedBy = caller.name || caller.email || '';
      writeState(tx, assignmentsRef, list);
    });
    return { ok: true };
  }

  if (action === 'deleteAssignment') {
    const { id } = data;
    if (!id) throw new HttpsError('invalid-argument', 'id is required.');
    await db.runTransaction(async (tx) => {
      const [assignSnap, usageSnap] = await Promise.all([tx.get(assignmentsRef), tx.get(usageRef)]);
      const list = stateArray(assignSnap).map((x) => ({ ...x }));
      const usage = stateArray(usageSnap);
      const row = list.find((x) => String(x.id) === String(id));
      if (!row) throw new HttpsError('not-found', 'Assignment not found.');
      if (isDeptBlocked(row.deptId)) {
        throw new HttpsError('permission-denied', 'Access to this department is restricted for your account.');
      }
      const hasPending = usage.some((u) => String(u.assignmentId) === String(id) && u.status === 'approved_waiting_receipt');
      if (hasPending) throw new HttpsError('failed-precondition', 'This custody has a request awaiting receipt and cannot be deleted. Deactivate it instead.');
      const hasHistory = usage.some((u) => String(u.assignmentId) === String(id));
      if (hasHistory) throw new HttpsError('failed-precondition', 'This custody has transaction history and cannot be deleted. Deactivate it instead.');
      writeState(tx, assignmentsRef, list.filter((x) => String(x.id) !== String(id)));
    });
    return { ok: true };
  }

  if (action === 'decision') {
    const { id, decision, note } = data;
    if (!id || !['approve', 'reject'].includes(decision)) {
      throw new HttpsError('invalid-argument', 'id and decision (approve/reject) are required.');
    }
    await db.runTransaction(async (tx) => {
      const [usageSnap, assignSnap] = await Promise.all([tx.get(usageRef), tx.get(assignmentsRef)]);
      const rows = stateArray(usageSnap).map((x) => ({ ...x }));
      const u = rows.find((x) => String(x.id) === String(id));
      if (!u || u.status !== 'pending_pharmacy') throw new HttpsError('failed-precondition', 'This request is no longer pending.');
      if (isDeptBlocked(u.deptId)) {
        throw new HttpsError('permission-denied', 'Access to this department is restricted for your account.');
      }
      const now = new Date().toISOString();
      const actorName = caller.name || caller.email || '';
      const actorEmail = caller.email || '';
      const noteStr = String(note || '').trim();
      if (decision === 'approve') {
        u.status = 'approved_waiting_receipt';
        u.approvedAt = now;
        u.approvedBy = actorName;
        u.approvedByUser = actorEmail;
        u.pharmacyNote = noteStr;
        // Deduct balance atomically with status change
        const assignments = stateArray(assignSnap).map((x) => ({ ...x }));
        const a = assignments.find((x) => String(x.id) === String(u.assignmentId));
        if (a) {
          a.balance = Math.max(0, number(a.balance) - number(u.units));
          a.updatedAt = now;
          writeState(tx, assignmentsRef, assignments);
        }
      } else {
        // Reject: balance was never formally deducted (only pending effective balance shown)
        u.status = 'rejected';
        u.rejectedAt = now;
        u.rejectedBy = actorName;
        u.rejectedByUser = actorEmail;
        u.rejectionReason = noteStr;
        u.pharmacyNote = noteStr;
      }
      writeState(tx, usageRef, rows);
    });
    return { ok: true };
  }

  if (action === 'undo_approve') {
    const { id } = data;
    if (!id) throw new HttpsError('invalid-argument', 'id is required.');
    await db.runTransaction(async (tx) => {
      const [usageSnap, assignSnap] = await Promise.all([tx.get(usageRef), tx.get(assignmentsRef)]);
      const rows = stateArray(usageSnap).map((x) => ({ ...x }));
      const u = rows.find((x) => String(x.id) === String(id));
      if (!u || u.status !== 'approved_waiting_receipt') {
        throw new HttpsError('failed-precondition', 'This request is not in an approved state.');
      }
      const now = new Date().toISOString();
      const actorName = caller.name || caller.email || '';
      // Restore balance (approve had deducted it)
      const assignments = stateArray(assignSnap).map((x) => ({ ...x }));
      const a = assignments.find((x) => String(x.id) === String(u.assignmentId));
      if (a) {
        a.balance = Math.min(number(a.quota), number(a.balance) + number(u.units));
        a.updatedAt = now;
        writeState(tx, assignmentsRef, assignments);
      }
      // Revert status to pending
      u.status = 'pending_pharmacy';
      delete u.approvedAt;
      delete u.approvedBy;
      delete u.approvedByUser;
      u.pharmacyNote = '';
      u.undoneAt = now;
      u.undoneBy = actorName;
      writeState(tx, usageRef, rows);
    });
    return { ok: true };
  }

  if (action === 'resetBalance') {
    const { id } = data;
    if (!id) throw new HttpsError('invalid-argument', 'id is required.');
    requireMaster(caller);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(assignmentsRef);
      const list = stateArray(snap).map((x) => ({ ...x }));
      const row = list.find((x) => String(x.id) === String(id));
      if (!row) throw new HttpsError('not-found', 'Assignment not found.');
      row.balance = row.quota;
      row.updatedAt = new Date().toISOString();
      row.updatedBy = caller.name || caller.email || '';
      writeState(tx, assignmentsRef, list);
    });
    return { ok: true };
  }

  throw new HttpsError('invalid-argument', `Unknown action: ${action}`);
});

exports.getSaasContext = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  const platformAdmin = isPlatformAdmin(request, caller);
  if (!caller.tenantId) {
    return { platformAdmin, subscription: { plan: 'enterprise', status: 'active', features: SAAS_PLANS.enterprise, legacy: true } };
  }
  const snap = await db.collection('tenants').doc(String(caller.tenantId)).get();
  if (!snap.exists) throw new HttpsError('failed-precondition', 'Organization subscription was not found.');
  return { platformAdmin, subscription: { ...snap.data(), tenantId: snap.id } };
});

exports.createTenantSubscription = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requirePlatformAdmin(request, caller);
  const data = request.data || {};
  const tenantId = String(data.tenantId || '').trim().toLowerCase();
  const name = String(data.name || '').trim();
  const ownerEmail = cleanEmail(data.ownerEmail);
  const password = String(data.password || '');
  const plan = String(data.plan || 'starter');
  const trialDays = Math.max(0, Math.min(90, Number(data.trialDays) || 0));
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(tenantId)) throw new HttpsError('invalid-argument', 'Organization code must be 3–40 lowercase letters, numbers, or hyphens.');
  if (!name) throw new HttpsError('invalid-argument', 'Organization name is required.');
  if (!ownerEmail.includes('@')) throw new HttpsError('invalid-argument', 'A valid owner email is required.');
  if (password.length < 8) throw new HttpsError('invalid-argument', 'Temporary password must be at least 8 characters.');
  if (!SAAS_PLANS[plan]) throw new HttpsError('invalid-argument', 'Invalid subscription plan.');
  const tenantRef = db.collection('tenants').doc(tenantId);
  if ((await tenantRef.get()).exists) throw new HttpsError('already-exists', 'Organization code already exists.');
  let owner;
  try {
    owner = await auth.createUser({ email: ownerEmail, password, emailVerified: false, disabled: false });
    const periodEnd = Timestamp.fromMillis(Date.now() + (trialDays || 30) * 86400000);
    const tenant = {
      id: tenantId, name, ownerEmail, ownerUid: owner.uid, plan,
      features: SAAS_PLANS[plan], status: trialDays ? 'trialing' : 'active',
      trialEndsAt: trialDays ? periodEnd : null, currentPeriodEnd: periodEnd,
      billingMode: 'manual', createdAt: FieldValue.serverTimestamp(), createdBy: caller.uid,
      updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid
    };
    const profile = {
      id: owner.uid, email: ownerEmail, displayName: name, role: 'pharmacy', master: true,
      tenantId, tenantName: name, active: true, createdAt: FieldValue.serverTimestamp(), createdBy: caller.uid
    };
    const batch = db.batch();
    batch.set(tenantRef, tenant);
    batch.set(db.collection('users').doc(owner.uid), profile);
    await batch.commit();
    await audit('tenant.create', caller, owner.uid, { tenantId, name, plan, trialDays });
    return { ok: true, tenantId, ownerUid: owner.uid };
  } catch (error) {
    if (owner) await auth.deleteUser(owner.uid).catch(() => {});
    if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'Owner email already exists.');
    if (error instanceof HttpsError) throw error;
    console.error('createTenantSubscription failed', error);
    throw new HttpsError('internal', 'Could not create the organization.');
  }
});

exports.listTenantSubscriptions = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requirePlatformAdmin(request, caller);
  const snap = await db.collection('tenants').orderBy('createdAt', 'desc').limit(200).get();
  return { tenants: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});

exports.updateTenantSubscription = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requirePlatformAdmin(request, caller);
  const data = request.data || {};
  const tenantId = String(data.tenantId || ''), plan = String(data.plan || ''), status = String(data.status || '');
  if (!SAAS_PLANS[plan] || !SUBSCRIPTION_STATUSES.has(status)) throw new HttpsError('invalid-argument', 'Invalid plan or status.');
  const ref = db.collection('tenants').doc(tenantId), snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Organization was not found.');
  const changes = { plan, status, features: SAAS_PLANS[plan], updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid };
  if (status === 'active') changes.currentPeriodEnd = Timestamp.fromMillis(Date.now() + 30 * 86400000);
  if (status === 'trialing' && (snap.data().status !== 'trialing' || !subscriptionWritable(snap.data()))) {
    changes.trialEndsAt = Timestamp.fromMillis(Date.now() + 14 * 86400000);
    changes.currentPeriodEnd = changes.trialEndsAt;
  }
  await ref.update(changes);
  await audit('tenant.subscription.update', caller, null, { tenantId, plan, status });
  return { ok: true };
});


const PUBLIC_HTTP_OPTIONS = { region: 'us-central1', cors: true };
const HANDOVER_COLLECTION = 'accountability_handover_sessions';
const HANDOVER_MINUTES_DEFAULT = 30;

function stateRef(key, tenantId = '') {
  return tenantId
    ? db.collection('tenants').doc(String(tenantId)).collection('state').doc(key)
    : db.collection('floorstock_state').doc(key);
}

function stateArray(snapshot) {
  const data = snapshot.exists ? snapshot.data() : {};
  return Array.isArray(data.value) ? data.value : [];
}

function writeState(transaction, reference, value) {
  transaction.set(reference, { value, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
}

// Audit entries are appended here rather than written straight from the browser.
// Client state writes replace a whole document, so any role holding audit_log
// write permission could previously erase or forge the entire trail; the rules
// can only validate {value, updatedAt} shape, never append-only semantics.
// audit_log is now write-denied in firestore.rules and this is the only path in.
const AUDIT_LOG_MAX_ENTRIES = 5000;

exports.appendAuditLog = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  const data = request.data || {};
  const action = String(data.action || '').trim().slice(0, 120);
  if (!action) throw new HttpsError('invalid-argument', 'action is required.');
  let meta = data.meta;
  if (meta === undefined || meta === null) meta = {};
  if (typeof meta !== 'object' || Array.isArray(meta)) {
    throw new HttpsError('invalid-argument', 'meta must be an object.');
  }
  // Cap the serialized payload so a client cannot bloat the document.
  const metaJson = JSON.stringify(meta);
  if (metaJson.length > 8000) throw new HttpsError('invalid-argument', 'meta payload is too large.');

  const ref = stateRef('audit_log', caller.tenantId || '');
  const entry = {
    id: `aud_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
    action,
    meta,
    // Actor fields are stamped from the verified session, never from the client,
    // so an entry cannot be attributed to someone else.
    at: new Date().toISOString(),
    actorId: request.auth.uid,
    actor: caller.name || caller.email || '',
    effectiveRole: caller.role || '',
    masterActing: caller.master === true
  };
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const rows = stateArray(snap);
    const next = rows.concat([entry]);
    // Trim oldest first so the document cannot grow past Firestore's 1MB limit.
    writeState(tx, ref, next.length > AUDIT_LOG_MAX_ENTRIES ? next.slice(next.length - AUDIT_LOG_MAX_ENTRIES) : next);
  });
  return { ok: true, id: entry.id };
});

function requestValue(request, name) {
  if (request.method === 'GET') return request.query[name];
  return request.body && request.body[name];
}

function sendJson(response, status, body) {
  response.set('Cache-Control', 'no-store, max-age=0');
  response.status(status).json(body);
}

function publicError(response, error) {
  console.error('Accountability handover public endpoint failed', error);
  const message = error && error.publicMessage ? error.publicMessage : 'The handover request could not be completed.';
  sendJson(response, error && error.statusCode || 400, { ok: false, error: message });
}

function asPublicError(message, statusCode = 400) {
  const error = new Error(message);
  error.publicMessage = message;
  error.statusCode = statusCode;
  return error;
}

exports.createAccountabilityHandover = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  const tenant = await requireWritableSubscription(caller);
  if (tenant && (!Array.isArray(tenant.features) || !tenant.features.includes('controlled'))) {
    throw new HttpsError('permission-denied', 'Controlled accountability is not included in this subscription.');
  }
  if (!canCreateHandover(caller)) {
    throw new HttpsError('permission-denied', 'This role cannot create accountability handovers.');
  }
  const requestedIds = Array.isArray(request.data && request.data.usageIds) ? request.data.usageIds : [];
  const usageIds = [...new Set(requestedIds.map((value) => String(value || '').trim()).filter(Boolean))];
  if (!usageIds.length || usageIds.length > 100) {
    throw new HttpsError('invalid-argument', 'Select between 1 and 100 approved accountability records.');
  }
  const requestedMinutes = Number(request.data && request.data.expiresInMinutes);
  const minutes = Math.max(5, Math.min(60, Number.isFinite(requestedMinutes) ? requestedMinutes : HANDOVER_MINUTES_DEFAULT));
  const pharmacyToken = createToken();
  const departmentToken = createToken();
  const sessionRef = db.collection(HANDOVER_COLLECTION).doc();
  const usageRef = stateRef('accountability_usage_v2', caller.tenantId);
  const departmentsRef = stateRef('departments', caller.tenantId);
  const expiresAt = Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);

  let responsePayload;
  await db.runTransaction(async (transaction) => {
    const [usageSnap, departmentsSnap] = await Promise.all([
      transaction.get(usageRef),
      transaction.get(departmentsRef)
    ]);
    const usage = stateArray(usageSnap).map((row) => ({ ...row }));
    const selected = usage.filter((row) => usageIds.includes(String(row.id)));
    if (selected.length !== usageIds.length) {
      throw new HttpsError('failed-precondition', 'One or more selected accountability records no longer exist.');
    }
    if (selected.some((row) => row.status !== 'approved_waiting_receipt')) {
      throw new HttpsError('failed-precondition', 'Only approved records waiting for receipt can be handed over.');
    }
    const deptIds = [...new Set(selected.map((row) => String(row.deptId || '')))].filter(Boolean);
    if (deptIds.length !== 1) {
      throw new HttpsError('failed-precondition', 'All selected records must belong to the same department.');
    }

    const existingSessionIds = [...new Set(selected.map((row) => row.handoverSessionId).filter(Boolean))];
    for (const existingId of existingSessionIds) {
      const existingSnap = await transaction.get(db.collection(HANDOVER_COLLECTION).doc(String(existingId)));
      if (existingSnap.exists) {
        const existing = existingSnap.data();
        const active = existing.status !== 'completed' && existing.expiresAt && existing.expiresAt.toMillis() > Date.now();
        if (active) throw new HttpsError('already-exists', 'A valid QR handover already exists for one or more selected records.');
      }
    }

    const deptId = deptIds[0];
    const departments = stateArray(departmentsSnap);
    const department = departments.find((row) => String(row.id) === deptId) || {};
    const medicineMap = new Map();
    for (const row of selected) {
      const key = String(row.assignmentId || row.medName || 'medicine');
      const item = medicineMap.get(key) || { assignmentId: String(row.assignmentId || ''), medName: row.medName || 'Medicine', units: 0 };
      item.units += Number(row.units) || 0;
      medicineMap.set(key, item);
      row.handoverSessionId = sessionRef.id;
      row.handoverStatus = 'waiting_both_confirmations';
      row.handoverExpiresAt = expiresAt.toDate().toISOString();
    }
    const nowIso = new Date().toISOString();
    const session = {
      id: sessionRef.id,
      tenantId: caller.tenantId || null,
      deptId,
      departmentName: department.name || department.nameEn || department.nameAr || deptId,
      usageIds,
      medicineTotals: [...medicineMap.values()],
      totalUnits: selected.reduce((sum, row) => sum + (Number(row.units) || 0), 0),
      pharmacyTokenHash: hashToken(pharmacyToken),
      departmentTokenHash: hashToken(departmentToken),
      status: 'waiting_both_confirmations',
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: nowIso,
      createdByUid: caller.uid,
      createdByName: caller.displayName || caller.email || caller.uid,
      createdByRole: caller.role || '',
      expiresAt,
      pharmacyConfirmation: null,
      departmentConfirmation: null
    };
    writeState(transaction, usageRef, usage);
    transaction.set(sessionRef, session, { merge: false });
    responsePayload = {
      sessionId: sessionRef.id,
      pharmacyToken,
      departmentToken,
      deptId,
      departmentName: session.departmentName,
      medicineTotals: session.medicineTotals,
      totalUnits: session.totalUnits,
      expiresAt: expiresAt.toDate().toISOString()
    };
  });

  await audit('accountability.handover.create', caller, null, {
    sessionId: responsePayload.sessionId,
    deptId: responsePayload.deptId,
    usageIds,
    expiresAt: responsePayload.expiresAt
  }).catch((error) => console.warn('Handover audit warning', error));
  return responsePayload;
});

// Voids any active session linked to the given usage IDs and creates a new one.
exports.reissueAccountabilityHandover = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  /* Reissuing writes handover sessions and usage rows exactly as creating one
     does, so it takes the same subscription and feature gate. Without it a tenant
     whose subscription had lapsed could not create a handover but could still
     reissue one, which is the same write through a different door. */
  const tenant = await requireWritableSubscription(caller);
  if (tenant && (!Array.isArray(tenant.features) || !tenant.features.includes('controlled'))) {
    throw new HttpsError('permission-denied', 'Controlled accountability is not included in this subscription.');
  }
  if (!canCreateHandover(caller)) {
    throw new HttpsError('permission-denied', 'This role cannot create accountability handovers.');
  }
  const requestedIds = Array.isArray(request.data && request.data.usageIds) ? request.data.usageIds : [];
  const usageIds = [...new Set(requestedIds.map((value) => String(value || '').trim()).filter(Boolean))];
  if (!usageIds.length || usageIds.length > 100) {
    throw new HttpsError('invalid-argument', 'Select between 1 and 100 approved accountability records.');
  }
  const requestedMinutes = Number(request.data && request.data.expiresInMinutes);
  const minutes = Math.max(5, Math.min(60, Number.isFinite(requestedMinutes) ? requestedMinutes : HANDOVER_MINUTES_DEFAULT));
  const pharmacyToken = createToken();
  const departmentToken = createToken();
  const newSessionRef = db.collection(HANDOVER_COLLECTION).doc();
  const usageRef = stateRef('accountability_usage_v2', caller.tenantId);
  const departmentsRef = stateRef('departments', caller.tenantId);
  const expiresAt = Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);

  let responsePayload;
  await db.runTransaction(async (transaction) => {
    const [usageSnap, departmentsSnap] = await Promise.all([
      transaction.get(usageRef),
      transaction.get(departmentsRef)
    ]);
    const usage = stateArray(usageSnap).map((row) => ({ ...row }));
    const selected = usage.filter((row) => usageIds.includes(String(row.id)));
    if (selected.length !== usageIds.length) {
      throw new HttpsError('failed-precondition', 'One or more selected records no longer exist.');
    }
    if (selected.some((row) => row.status !== 'approved_waiting_receipt')) {
      throw new HttpsError('failed-precondition', 'Only approved records waiting for receipt can be handed over.');
    }
    const deptIds = [...new Set(selected.map((row) => String(row.deptId || '')))].filter(Boolean);
    if (deptIds.length !== 1) throw new HttpsError('failed-precondition', 'All selected records must belong to the same department.');

    // Void any still-active sessions
    const existingSessionIds = [...new Set(selected.map((row) => row.handoverSessionId).filter(Boolean))];
    for (const existingId of existingSessionIds) {
      const existingSnap = await transaction.get(db.collection(HANDOVER_COLLECTION).doc(String(existingId)));
      if (existingSnap.exists) {
        const existing = existingSnap.data();
        const active = existing.status !== 'completed' && existing.expiresAt && existing.expiresAt.toMillis() > Date.now();
        if (active) {
          transaction.update(db.collection(HANDOVER_COLLECTION).doc(String(existingId)), {
            status: 'voided',
            voidedAt: FieldValue.serverTimestamp(),
            voidedBy: caller.email || caller.uid
          });
        }
      }
    }

    const deptId = deptIds[0];
    const departments = stateArray(departmentsSnap);
    const department = departments.find((row) => String(row.id) === deptId) || {};
    const medicineMap = new Map();
    for (const row of selected) {
      const key = String(row.assignmentId || row.medName || 'medicine');
      const item = medicineMap.get(key) || { assignmentId: String(row.assignmentId || ''), medName: row.medName || 'Medicine', units: 0 };
      item.units += Number(row.units) || 0;
      medicineMap.set(key, item);
      row.handoverSessionId = newSessionRef.id;
      row.handoverStatus = 'waiting_both_confirmations';
      row.handoverExpiresAt = expiresAt.toDate().toISOString();
    }
    const nowIso = new Date().toISOString();
    const session = {
      id: newSessionRef.id,
      tenantId: caller.tenantId || null,
      deptId,
      departmentName: department.name || department.nameEn || department.nameAr || deptId,
      usageIds,
      medicineTotals: [...medicineMap.values()],
      totalUnits: selected.reduce((sum, row) => sum + (Number(row.units) || 0), 0),
      pharmacyTokenHash: hashToken(pharmacyToken),
      departmentTokenHash: hashToken(departmentToken),
      status: 'waiting_both_confirmations',
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: nowIso,
      createdByUid: caller.uid,
      createdByName: caller.displayName || caller.email || caller.uid,
      createdByRole: caller.role || '',
      expiresAt,
      pharmacyConfirmation: null,
      departmentConfirmation: null,
      reissuedFrom: existingSessionIds[0] || null
    };
    writeState(transaction, usageRef, usage);
    transaction.set(newSessionRef, session, { merge: false });
    responsePayload = {
      sessionId: newSessionRef.id,
      pharmacyToken,
      departmentToken,
      deptId,
      departmentName: session.departmentName,
      medicineTotals: session.medicineTotals,
      totalUnits: session.totalUnits,
      expiresAt: expiresAt.toDate().toISOString()
    };
  });

  await audit('accountability.handover.reissue', caller, null, {
    sessionId: responsePayload.sessionId,
    deptId: responsePayload.deptId,
    usageIds
  }).catch((error) => console.warn('Handover reissue audit warning', error));
  return responsePayload;
});

exports.getAccountabilityHandover = onRequest(PUBLIC_HTTP_OPTIONS, async (request, response) => {
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'GET') return sendJson(response, 405, { ok: false, error: 'Method not allowed.' });
  await logAppCheckStatus(request, 'getAccountabilityHandover');
  try {
    const sessionId = cleanIdentity(requestValue(request, 'session'), 100);
    const party = cleanIdentity(requestValue(request, 'party'), 20);
    const token = String(requestValue(request, 'token') || '');
    if (!sessionId || !['pharmacy', 'department'].includes(party) || !token) throw asPublicError('Invalid or incomplete handover link.');
    const snap = await db.collection(HANDOVER_COLLECTION).doc(sessionId).get();
    if (!snap.exists) throw asPublicError('This handover link does not exist.', 404);
    const session = snap.data();
    const expected = party === 'pharmacy' ? session.pharmacyTokenHash : session.departmentTokenHash;
    if (!tokenMatches(token, expected)) throw asPublicError('This handover link is invalid.', 403);
    const expiresAtMs2 = session.expiresAt
      ? (typeof session.expiresAt.toMillis === 'function' ? session.expiresAt.toMillis() : new Date(session.expiresAt).getTime())
      : 0;
    const expired = !session.expiresAt || expiresAtMs2 <= Date.now();
    const confirmation = party === 'pharmacy' ? session.pharmacyConfirmation : session.departmentConfirmation;
    sendJson(response, 200, {
      ok: true,
      session: {
        id: sessionId,
        party,
        partyLabel: party === 'pharmacy' ? 'Pharmacy delivery / تسليم الصيدلية' : 'Department receipt / استلام القسم',
        departmentName: session.departmentName || session.deptId || '',
        medicineTotals: session.medicineTotals || [],
        totalUnits: session.totalUnits || 0,
        expiresAt: session.expiresAt ? session.expiresAt.toDate().toISOString() : null,
        expired,
        status: session.status || 'waiting_both_confirmations',
        alreadyConfirmed: !!confirmation,
        confirmation: confirmation ? { name: confirmation.name, employeeId: confirmation.employeeId, confirmedAt: confirmation.confirmedAt } : null,
        pharmacyConfirmed: !!session.pharmacyConfirmation,
        departmentConfirmed: !!session.departmentConfirmation
      }
    });
  } catch (error) {
    publicError(response, error);
  }
});

exports.confirmAccountabilityHandover = onRequest(PUBLIC_HTTP_OPTIONS, async (request, response) => {
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return sendJson(response, 405, { ok: false, error: 'Method not allowed.' });
  await logAppCheckStatus(request, 'confirmAccountabilityHandover');
  try {
    const sessionId = cleanIdentity(requestValue(request, 'session'), 100);
    const party = cleanIdentity(requestValue(request, 'party'), 20);
    const token = String(requestValue(request, 'token') || '');
    const name = cleanIdentity(requestValue(request, 'name'), 120);
    const employeeId = cleanIdentity(requestValue(request, 'employeeId'), 60);
    if (!sessionId || !['pharmacy', 'department'].includes(party) || !token) throw asPublicError('Invalid or incomplete handover link.');
    if (name.length < 2 || employeeId.length < 2) throw asPublicError('Enter the employee name and employee number.');

    const sessionRef = db.collection(HANDOVER_COLLECTION).doc(sessionId);
    const routingSnap = await sessionRef.get();
    if (!routingSnap.exists) throw asPublicError('This handover link does not exist.', 404);
    const tenantId = String(routingSnap.data().tenantId || '');
    const usageRef = stateRef('accountability_usage_v2', tenantId);
    const assignmentsRef = stateRef('accountability_assignments_v2', tenantId);
    const receiptsRef = stateRef('accountability_receipts_v2', tenantId);
    let result;
    await db.runTransaction(async (transaction) => {
      const [sessionSnap, usageSnap, assignmentsSnap, receiptsSnap] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(usageRef),
        transaction.get(assignmentsRef),
        transaction.get(receiptsRef)
      ]);
      if (!sessionSnap.exists) throw asPublicError('This handover link does not exist.', 404);
      const session = { id: sessionId, ...sessionSnap.data() };
      const expected = party === 'pharmacy' ? session.pharmacyTokenHash : session.departmentTokenHash;
      if (!tokenMatches(token, expected)) throw asPublicError('This handover link is invalid.', 403);
      const expiresAtMs = session.expiresAt
        ? (typeof session.expiresAt.toMillis === 'function' ? session.expiresAt.toMillis() : new Date(session.expiresAt).getTime())
        : 0;
      if (!session.expiresAt || expiresAtMs <= Date.now()) throw asPublicError('This handover link has expired.', 410);
      const nowIso = new Date().toISOString();
      const confirmation = applyPartyConfirmation(session, party, { name, employeeId }, nowIso);
      Object.assign(session, confirmation.session);
      if (confirmation.alreadyConfirmed) {
        result = { completed: session.status === 'completed', alreadyConfirmed: true, status: session.status };
        return;
      }
      if (!confirmation.complete) {
        transaction.set(sessionRef, { ...session, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
        result = { completed: false, alreadyConfirmed: false, status: session.status };
        return;
      }

      const completed = completeHandoverState({
        assignments: stateArray(assignmentsSnap),
        usage: stateArray(usageSnap),
        receipts: stateArray(receiptsSnap),
        session,
        nowIso
      });
      session.status = 'completed';
      session.completedAt = nowIso;
      session.receiptId = completed.receipt.id;
      writeState(transaction, assignmentsRef, completed.assignments);
      writeState(transaction, usageRef, completed.usage);
      writeState(transaction, receiptsRef, completed.receipts);
      transaction.set(sessionRef, { ...session, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
      result = { completed: true, alreadyConfirmed: false, status: 'completed', receiptId: completed.receipt.id };
    });
    await db.collection('audit_logs').add({
      action: 'accountability.handover.public-confirm',
      actorUid: null,
      actorEmail: null,
      targetUid: null,
      details: { sessionId, party, employeeId, completed: result.completed === true },
      createdAt: FieldValue.serverTimestamp()
    }).catch((error) => console.warn('Public handover audit warning', error));
    sendJson(response, 200, { ok: true, ...result });
  } catch (error) {
    publicError(response, error);
  }
});
