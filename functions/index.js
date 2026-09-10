'use strict';

const crypto = require('crypto');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const upkeepCore = require('./upkeep-core');
const accountabilityPartitions = require('./accountability-partitions-core');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getAppCheck } = require('firebase-admin/app-check');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { canCreateHandover, createToken, hashToken, tokenMatches, cleanIdentity, number, applyPartyConfirmation, pharmacyConfirmationFromAccount, completeHandoverState } = require('./accountability-handover-core');

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
    /* Whole units only. The count is of items taken out of a cupboard and signed
       for: half an ampoule cannot be reconciled against a physical count or
       handed over at a shift change. Enforced here as well as on the screen,
       because the screen is not the authority. */
    if (!Number.isInteger(units)) {
      throw new HttpsError('invalid-argument', 'Units used must be a whole number.');
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
      // The pending total has to be searched for rather than addressed by id, so
      // this is the one operation that reads a window of months.
      const loaded = await readMonthPartitions(tx, tenantId, accountabilityPartitions.recentHijriMonths(USAGE_WINDOW_MONTHS));
      const assignSnap = await tx.get(assignmentsRef);
      const assignments = stateArray(assignSnap);
      const a = assignments.find((x) => String(x.id) === String(assignmentId));
      if (!a || a.active === false) throw new HttpsError('failed-precondition', 'Custody is not available.');
      // The department may only spend against its own custody record.
      if (String(a.deptId) !== callerDept) throw new HttpsError('permission-denied', 'This custody belongs to another department.');
      const rows = loaded.rows;
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
      writeMonthPartitions(tx, tenantId, loaded, rows.concat([created]));
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
      const loaded = await readMonthPartitions(tx, tenantId, usageMonthsForIds([id]));
      const rows = loaded.rows;
      const u = rows.find((x) => String(x.id) === String(id));
      if (!u) throw new HttpsError('not-found', 'This submission no longer exists.');
      // Only the owning department, and only before pharmacy has acted on it.
      if (String(u.deptId) !== callerDept) throw new HttpsError('permission-denied', 'This submission belongs to another department.');
      if (u.status !== 'pending_pharmacy' && u.status !== 'rejected') {
        throw new HttpsError('failed-precondition', 'This submission can no longer be modified.');
      }
      writeMonthPartitions(tx, tenantId, loaded, rows.filter((x) => String(x.id) !== String(id)));
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
      /* This refuses to delete a custody that has ANY history, so it has to look
         across the whole retention window rather than a recent slice — a stale
         read here would delete a custody with records behind it. Sixty months is
         the five-year floor; it runs only on a master's explicit delete. */
      const loaded = await readMonthPartitions(tx, tenantId, accountabilityPartitions.recentHijriMonths(60));
      const assignSnap = await tx.get(assignmentsRef);
      const list = stateArray(assignSnap).map((x) => ({ ...x }));
      const usage = loaded.rows;
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
      const loaded = await readMonthPartitions(tx, tenantId, usageMonthsForIds([id]));
      const assignSnap = await tx.get(assignmentsRef);
      const rows = loaded.rows.map((x) => ({ ...x }));
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
      writeMonthPartitions(tx, tenantId, loaded, rows);
    });
    return { ok: true };
  }

  if (action === 'undo_approve') {
    const { id } = data;
    if (!id) throw new HttpsError('invalid-argument', 'id is required.');
    await db.runTransaction(async (tx) => {
      const loaded = await readMonthPartitions(tx, tenantId, usageMonthsForIds([id]));
      const assignSnap = await tx.get(assignmentsRef);
      const rows = loaded.rows.map((x) => ({ ...x }));
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
      writeMonthPartitions(tx, tenantId, loaded, rows);
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

/* Accountability usage is stored one document per Hijri month (see
   accountability-partitions-core.js for why). These three helpers are the whole
   difference at the call sites: read the partitions an operation could touch,
   run exactly the same logic on the flat array it used to get, then write back
   only the months that actually changed.

   Which partitions to read is decided two ways. An operation that names rows by
   id derives their months from the ids themselves, which is exact and reads
   nothing extra. An operation that has to search — the pending-balance check —
   reads a window of recent months; a row left pending beyond that window is not
   silently mishandled, it simply is not found, and the existing not-found guards
   turn that into a clear error. */
const USAGE_WINDOW_MONTHS = 24;
const USAGE_MAX_PARTS = 50;

async function readMonthPartitions(tx, tenantId, months, partitionIdFor) {
  const idFor = partitionIdFor || accountabilityPartitions.usagePartitionId;
  const loadedMonths = [];
  const rowsByMonth = {};
  const refsByMonth = {};
  let rows = [];
  for (const month of months) {
    const partRefs = [];
    let monthRows = [];
    for (let part = 1; part <= USAGE_MAX_PARTS; part += 1) {
      const ref = stateRef(idFor(month, part), tenantId);
      // eslint-disable-next-line no-await-in-loop
      const snapshot = await tx.get(ref);
      partRefs.push(ref);
      if (!snapshot.exists) break;
      monthRows = monthRows.concat(stateArray(snapshot));
    }
    loadedMonths.push(month);
    rowsByMonth[month] = monthRows;
    refsByMonth[month] = partRefs;
    rows = rows.concat(monthRows);
  }
  return { rows, loadedMonths, rowsByMonth, refsByMonth, idFor };
}

/* Splits a month's rows back across its parts under the size limit, so a busy
   month grows another document instead of refusing the write. */
function writeMonthPartition(tx, loaded, tenantId, month, rows) {
  const idFor = loaded.idFor || accountabilityPartitions.usagePartitionId;
  const LIMIT = 800 * 1024;
  const chunks = [[]];
  rows.forEach((row) => {
    const current = chunks[chunks.length - 1];
    current.push(row);
    if (current.length > 1 && Buffer.byteLength(JSON.stringify(current), 'utf8') > LIMIT) {
      chunks[chunks.length - 1] = current.slice(0, -1);
      chunks.push([row]);
    }
  });
  const existing = (loaded.refsByMonth[month] || []).length;
  chunks.forEach((chunk, index) => {
    writeState(tx, stateRef(idFor(month, index + 1), tenantId), chunk);
  });
  // A month that shrank leaves trailing parts behind; empty them rather than
  // leaving stale rows readable.
  for (let part = chunks.length + 1; part <= existing; part += 1) {
    writeState(tx, stateRef(idFor(month, part), tenantId), []);
  }
}

function writeMonthPartitions(tx, tenantId, loaded, nextRows, monthOf) {
  const plan = accountabilityPartitions.planPartitionWrites(loaded.loadedMonths, loaded.rowsByMonth, nextRows, monthOf);
  plan.writes.forEach((entry) => writeMonthPartition(tx, loaded, tenantId, entry.month, entry.rows));
  /* A row grouped into a month the transaction never read cannot be written:
     the write would replace that document with only these rows, discarding
     whatever else it holds. It should be unreachable — every operation loads the
     months its rows belong to — so this fails loudly rather than corrupting the
     record it could not see. */
  if (plan.unplaced.length) {
    console.error('custody rows fell outside the loaded months', plan.unplaced.map((e) => e.month));
    throw new HttpsError('internal', 'A custody record fell outside the months this operation loaded. Nothing was changed.');
  }
}

function usageMonthsForIds(ids) {
  const months = new Set();
  (ids || []).forEach((id) => {
    const month = accountabilityPartitions.monthOfUsageId(id);
    if (month) months.add(month);
  });
  return [...months];
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
//
// The trail is written to one document per calendar month — audit_log_YYYY-MM —
// rather than to a single audit_log document. That document was capped at 1 MiB
// like every other, and the cap was handled by silently discarding the OLDEST
// 5000+ entries on every append: a compliance trail that quietly deleted its own
// history, which is the opposite of what it is for. A monthly document starts
// empty, so the ceiling is never approached in ordinary use and nothing is ever
// dropped. A month that does fill up rolls to a numbered part rather than
// discarding anything, so an unusually heavy month costs an extra document
// instead of losing its beginning.
const AUDIT_LOG_PART_MAX_BYTES = 800 * 1024;
const AUDIT_LOG_MAX_PARTS = 50;

function auditLogMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Part 1 keeps the bare month key so the common case reads as audit_log_2026-09.
function auditLogPartKey(monthKey, part) {
  return part <= 1 ? `audit_log_${monthKey}` : `audit_log_${monthKey}_p${part}`;
}

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
  const monthKey = auditLogMonthKey();
  const tenantId = caller.tenantId || '';
  // Walk forward to the first part with room. Almost always the first read.
  let part = 1;
  let written = false;
  for (; part <= AUDIT_LOG_MAX_PARTS; part += 1) {
    const ref = stateRef(auditLogPartKey(monthKey, part), tenantId);
    const full = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const rows = stateArray(snap);
      const next = rows.concat([entry]);
      // Measured, not counted: entry sizes vary with their meta payload, so a
      // fixed row count either wastes most of the document or overshoots it.
      if (rows.length && Buffer.byteLength(JSON.stringify(next), 'utf8') > AUDIT_LOG_PART_MAX_BYTES) return true;
      writeState(tx, ref, next);
      return false;
    });
    if (!full) { written = true; break; }
  }
  if (!written) throw new HttpsError('resource-exhausted', 'The audit trail for this month is full.');
  return { ok: true, id: entry.id, key: auditLogPartKey(monthKey, part) };
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
  const departmentToken = createToken();
  const sessionRef = db.collection(HANDOVER_COLLECTION).doc();
  const departmentsRef = stateRef('departments', caller.tenantId);
  const expiresAt = Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);

  let responsePayload;
  await db.runTransaction(async (transaction) => {
    // The selected records are named by id, so their Hijri months are known
    // exactly — no window, and nothing outside them is read or rewritten.
    const loaded = await readMonthPartitions(transaction, caller.tenantId, usageMonthsForIds(usageIds));
    const departmentsSnap = await transaction.get(departmentsRef);
    const usage = loaded.rows.map((row) => ({ ...row }));
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
      row.handoverStatus = 'waiting_department';
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
      // No pharmacy token: the pharmacist is the signed-in account that created
      // this handover, stamped below, so there is nothing for them to scan.
      departmentTokenHash: hashToken(departmentToken),
      status: 'pharmacy_confirmed',
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: nowIso,
      createdByUid: caller.uid,
      createdByName: caller.displayName || caller.email || caller.uid,
      createdByRole: caller.role || '',
      expiresAt,
      pharmacyConfirmation: pharmacyConfirmationFromAccount(caller, nowIso),
      departmentConfirmation: null
    };
    writeMonthPartitions(transaction, caller.tenantId, loaded, usage);
    transaction.set(sessionRef, session, { merge: false });
    responsePayload = {
      sessionId: sessionRef.id,
      departmentToken,
      deptId,
      departmentName: session.departmentName,
      // Returned so the modal can name who the delivery was recorded under
      // without a second round trip.
      pharmacyConfirmation: session.pharmacyConfirmation,
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
  const departmentToken = createToken();
  const newSessionRef = db.collection(HANDOVER_COLLECTION).doc();
  const departmentsRef = stateRef('departments', caller.tenantId);
  const expiresAt = Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);

  let responsePayload;
  await db.runTransaction(async (transaction) => {
    // The selected records are named by id, so their Hijri months are known
    // exactly — no window, and nothing outside them is read or rewritten.
    const loaded = await readMonthPartitions(transaction, caller.tenantId, usageMonthsForIds(usageIds));
    const departmentsSnap = await transaction.get(departmentsRef);
    const usage = loaded.rows.map((row) => ({ ...row }));
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
      row.handoverStatus = 'waiting_department';
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
      // No pharmacy token: the pharmacist is the signed-in account that created
      // this handover, stamped below, so there is nothing for them to scan.
      departmentTokenHash: hashToken(departmentToken),
      status: 'pharmacy_confirmed',
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: nowIso,
      createdByUid: caller.uid,
      createdByName: caller.displayName || caller.email || caller.uid,
      createdByRole: caller.role || '',
      expiresAt,
      pharmacyConfirmation: pharmacyConfirmationFromAccount(caller, nowIso),
      departmentConfirmation: null,
      reissuedFrom: existingSessionIds[0] || null
    };
    writeMonthPartitions(transaction, caller.tenantId, loaded, usage);
    transaction.set(newSessionRef, session, { merge: false });
    responsePayload = {
      sessionId: newSessionRef.id,
      departmentToken,
      deptId,
      departmentName: session.departmentName,
      // Returned so the modal can name who the delivery was recorded under
      // without a second round trip.
      pharmacyConfirmation: session.pharmacyConfirmation,
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
    /* Only the receiving department confirms now; the pharmacist is taken from the
       account that created the handover. A session created since that change has
       no pharmacy token, so a pharmacy link cannot match — older sessions that
       still carry one keep working until they expire. */
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
        status: session.status || 'pharmacy_confirmed',
        /* Who handed the medicines over, so the nurse confirming receipt can see
           whose delivery they are signing for. Taken from the pharmacist's own
           account when the handover was created. */
        deliveredBy: (session.pharmacyConfirmation && session.pharmacyConfirmation.name) || '',
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
    const assignmentsRef = stateRef('accountability_assignments_v2', tenantId);
    /* Completed handovers are stored one document per Hijri month, like usage and
       the movement ledger. The legacy single document is read too: until a master
       runs the migration it is still the live record, and writing the partition
       first would split the register in two. `nowIso` is fixed here rather than
       inside the transaction so the receipt's month and its receivedAt cannot
       disagree across a month boundary — a disagreement would be refused as a row
       outside the loaded months, failing a handover for a millisecond. */
    const legacyReceiptsRef = stateRef(accountabilityPartitions.RECEIPTS_KEY, tenantId);
    const nowIso = new Date().toISOString();
    const receiptMonth = accountabilityPartitions.hijriMonthKeyOf(nowIso);
    let result;
    await db.runTransaction(async (transaction) => {
      /* The session names the usage records, so it is read first and its ids
         decide which Hijri months are loaded. Firestore only requires that every
         read precede every write, not that they be issued together. */
      const [sessionSnap, assignmentsSnap, legacyReceiptsSnap] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(assignmentsRef),
        transaction.get(legacyReceiptsRef)
      ]);
      if (!sessionSnap.exists) throw asPublicError('This handover link does not exist.', 404);
      const session = { id: sessionId, ...sessionSnap.data() };
      const loaded = await readMonthPartitions(
        transaction,
        tenantId,
        usageMonthsForIds(Array.isArray(session.usageIds) ? session.usageIds : []),
      );
      /* Only the receiving department confirms now; the pharmacist is taken from the
       account that created the handover. A session created since that change has
       no pharmacy token, so a pharmacy link cannot match — older sessions that
       still carry one keep working until they expire. */
    const expected = party === 'pharmacy' ? session.pharmacyTokenHash : session.departmentTokenHash;
      if (!tokenMatches(token, expected)) throw asPublicError('This handover link is invalid.', 403);
      const expiresAtMs = session.expiresAt
        ? (typeof session.expiresAt.toMillis === 'function' ? session.expiresAt.toMillis() : new Date(session.expiresAt).getTime())
        : 0;
      if (!session.expiresAt || expiresAtMs <= Date.now()) throw asPublicError('This handover link has expired.', 410);
      const receiptsLoaded = legacyReceiptsSnap.exists
        ? null
        : await readMonthPartitions(transaction, tenantId, [receiptMonth], accountabilityPartitions.receiptsPartitionId);
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
        usage: loaded.rows,
        receipts: legacyReceiptsSnap.exists ? stateArray(legacyReceiptsSnap) : receiptsLoaded.rows,
        session,
        nowIso
      });
      session.status = 'completed';
      session.completedAt = nowIso;
      session.receiptId = completed.receipt.id;
      writeState(transaction, assignmentsRef, completed.assignments);
      writeMonthPartitions(transaction, tenantId, loaded, completed.usage);
      if (legacyReceiptsSnap.exists) writeState(transaction, legacyReceiptsRef, completed.receipts);
      else writeMonthPartitions(transaction, tenantId, receiptsLoaded, completed.receipts, accountabilityPartitions.monthOfReceiptRow);
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


/* ─────────────────────────────────────────────────────────────────────────
   Scheduled upkeep
   ─────────────────────────────────────────────────────────────────────────
   The same housekeeping the app does in a master's browser, run once a day
   whether or not anybody signs in. Four jobs, and deliberately not a fifth: the
   month migrations are NOT here. Those are the ones that duplicated production
   data when they ran unattended, they have already run, and a migration is a
   one-time move that should never be on a timer.

   Everything here is idempotent — a second run changes nothing — bounded to the
   rows its own declared policy names, and written down: every run records what
   it did, because upkeep nobody can see is indistinguishable from upkeep that
   never happened.

   It starts in DRY RUN. The first days report what they would have done and
   change nothing, so the numbers can be read before anything is deleted; a
   master turns it on with setUpkeepSettings once those numbers look right. */

const UPKEEP_SETTINGS_PATH = 'system/upkeep_settings';

// The same options every other callable in this file uses.
const UPKEEP_CALLABLE_OPTIONS = CALLABLE_OPTIONS;

async function upkeepSettings() {
  const snapshot = await db.doc(UPKEEP_SETTINGS_PATH).get();
  const data = snapshot.exists ? snapshot.data() : {};
  return {
    // Both default to the cautious answer, so a fresh deployment reports and
    // waits rather than acting.
    enabled: data.enabled === true,
    dryRun: data.dryRun !== false,
  };
}

/* Every tenant, plus the legacy root installation, as {stateRef, reportsRef}. */
async function upkeepScopes() {
  const scopes = [{ tenantId: '', state: db.collection('floorstock_state'), reports: db.collection('crash_cart_reports_v2') }];
  const tenants = await db.collection('tenants').select().get();
  tenants.forEach((doc) => scopes.push({
    tenantId: doc.id,
    state: db.collection('tenants').doc(doc.id).collection('state'),
    reports: db.collection('tenants').doc(doc.id).collection('crash_cart_reports'),
  }));
  return scopes;
}

function stateRows(snapshot) {
  const value = snapshot.exists ? snapshot.data().value : null;
  return Array.isArray(value) ? value : null;
}

async function upkeepRotate(scope, dryRun, now) {
  const changes = [];
  for (const policy of upkeepCore.ROTATIONS) {
    // eslint-disable-next-line no-await-in-loop
    const docs = await scope.state.get();
    for (const doc of docs.docs) {
      const expired = upkeepCore.partitionMonthIsExpired(doc.id, policy.key, policy, now);
      if (expired === true) {
        const rows = stateRows(doc) || [];
        changes.push({ job: 'rotate', doc: doc.id, removed: rows.length, action: 'delete' });
        // eslint-disable-next-line no-await-in-loop
        if (!dryRun) await doc.ref.delete();
        continue;
      }
      if (expired !== false && doc.id !== policy.key) continue;
      const rows = stateRows(doc);
      if (!rows) continue;
      const result = upkeepCore.rotateRows(rows, policy, now);
      if (!result.dropped) continue;
      changes.push({ job: 'rotate', doc: doc.id, removed: result.dropped, action: 'trim' });
      // eslint-disable-next-line no-await-in-loop
      if (!dryRun) await doc.ref.set({ value: result.kept, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
    }
  }
  return changes;
}

async function upkeepTrimMergeHistories(scope, dryRun) {
  const changes = [];
  for (const policy of upkeepCore.MERGE_HISTORIES) {
    const ref = scope.state.doc(policy.key);
    // eslint-disable-next-line no-await-in-loop
    const snapshot = await ref.get();
    const rows = stateRows(snapshot);
    if (!rows || !rows.length) continue;
    const result = upkeepCore.trimToBudget(rows, policy.maxBytes);
    if (!result.dropped && result.kept.length === rows.length) continue;
    changes.push({ job: 'trim', doc: policy.key, removed: result.dropped });
    // eslint-disable-next-line no-await-in-loop
    if (!dryRun) await ref.set({ value: result.kept, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
  }
  return changes;
}

async function upkeepArchiveCrashReports(scope, dryRun, now) {
  const snapshot = await scope.reports.get();
  const reports = snapshot.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  const due = upkeepCore.reportsToArchive(reports, now);
  if (!due.length) return [];
  const grouped = upkeepCore.groupByGregorianMonth(due, ['openedAt', 'closedAt', 'lastEditedAt']);
  const changes = [];
  for (const month of Object.keys(grouped)) {
    const ref = scope.state.doc(`${upkeepCore.CRASH_REPORT_ARCHIVE_KEY}_g${month}`);
    // eslint-disable-next-line no-await-in-loop
    const existing = await ref.get();
    const held = stateRows(existing) || [];
    const heldIds = new Set(held.map((row) => String(row && row.id)));
    const adding = grouped[month].filter((row) => !heldIds.has(String(row.id)));
    changes.push({ job: 'archive', doc: ref.id, added: adding.length, removedFromCollection: grouped[month].length });
    if (dryRun) continue;
    /* The month is written FIRST and the collection documents removed only after
       it succeeds, so a failure at any point leaves every report where it was. */
    // eslint-disable-next-line no-await-in-loop
    if (adding.length) await ref.set({ value: held.concat(adding), updatedAt: FieldValue.serverTimestamp() }, { merge: false });
    for (const row of grouped[month]) {
      // eslint-disable-next-line no-await-in-loop
      await scope.reports.doc(String(row.id)).delete();
    }
  }
  return changes;
}

async function upkeepDedupe(scope, dryRun) {
  const docs = await scope.state.get();
  const families = {};
  docs.forEach((doc) => {
    const match = /^(.*)_[gh]\d{4}-\d{2}(?:_p\d+)?$/.exec(doc.id);
    if (!match) return;
    const rows = stateRows(doc);
    if (!rows) return;
    (families[match[1]] = families[match[1]] || {})[doc.id] = rows;
  });
  const changes = [];
  for (const key of Object.keys(families)) {
    const plan = upkeepCore.planDedupe(families[key]);
    if (!plan.removed) continue;
    changes.push({ job: 'dedupe', doc: key, removed: plan.removed });
    if (dryRun) continue;
    for (const docId of Object.keys(plan.writes)) {
      // eslint-disable-next-line no-await-in-loop
      await scope.state.doc(docId).set({ value: plan.writes[docId], updatedAt: FieldValue.serverTimestamp() }, { merge: false });
    }
  }
  return changes;
}

async function runScheduledUpkeep(trigger) {
  const settings = await upkeepSettings();
  const now = new Date();
  const started = now.toISOString();
  if (!settings.enabled) {
    console.log('[upkeep] disabled; set system/upkeep_settings.enabled to run.');
    return { skipped: true, reason: 'disabled', trigger };
  }
  const scopes = await upkeepScopes();
  const changes = [];
  const failures = [];
  for (const scope of scopes) {
    for (const job of [upkeepRotate, upkeepTrimMergeHistories, upkeepArchiveCrashReports, upkeepDedupe]) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await job(scope, settings.dryRun, now);
        result.forEach((entry) => changes.push(Object.assign({ tenantId: scope.tenantId }, entry)));
      } catch (error) {
        /* One failing job must not stop the rest, and must not vanish: the run
           record is the only place anybody would ever see it. */
        console.error('[upkeep] job failed', scope.tenantId, job.name, error);
        failures.push({ tenantId: scope.tenantId, job: job.name, error: String(error && error.message || error) });
      }
    }
  }
  const record = {
    startedAt: started,
    finishedAt: new Date().toISOString(),
    trigger,
    dryRun: settings.dryRun,
    changes,
    failures,
    totals: changes.reduce((total, entry) => total + (entry.removed || entry.added || 0), 0),
  };
  await db.doc(UPKEEP_SETTINGS_PATH).set({ lastRun: record }, { merge: true });
  await db.collection('audit_logs').add({
    action: 'system.scheduled-upkeep',
    actorUid: null,
    actorEmail: null,
    targetUid: null,
    details: { dryRun: settings.dryRun, trigger, changeCount: changes.length, failureCount: failures.length, totals: record.totals },
    createdAt: FieldValue.serverTimestamp(),
  }).catch((error) => console.warn('[upkeep] audit write failed', error));
  console.log('[upkeep]', settings.dryRun ? 'DRY RUN' : 'applied', JSON.stringify(record.totals), 'changes:', changes.length, 'failures:', failures.length);
  return record;
}

exports.scheduledUpkeep = onSchedule(
  { schedule: 'every day 03:15', timeZone: 'Asia/Riyadh', region: 'us-central1', memory: '512MiB', timeoutSeconds: 540 },
  async () => { await runScheduledUpkeep('schedule'); },
);

/* A master reads the last run and turns it on, so neither the switch nor the
   result needs the Firebase console. */
exports.upkeepStatus = onCall(UPKEEP_CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requireMaster(caller);
  const settings = await upkeepSettings();
  const snapshot = await db.doc(UPKEEP_SETTINGS_PATH).get();
  return { ok: true, settings, lastRun: (snapshot.exists && snapshot.data().lastRun) || null };
});

exports.setUpkeepSettings = onCall(UPKEEP_CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requireMaster(caller);
  const update = {};
  if (typeof request.data?.enabled === 'boolean') update.enabled = request.data.enabled;
  if (typeof request.data?.dryRun === 'boolean') update.dryRun = request.data.dryRun;
  if (!Object.keys(update).length) throw new HttpsError('invalid-argument', 'Nothing to change.');
  await db.doc(UPKEEP_SETTINGS_PATH).set(update, { merge: true });
  return { ok: true, settings: await upkeepSettings() };
});

/* Runs it now, for a master who wants to see what the schedule would do rather
   than wait a day for it. Obeys the same dry-run setting. */
exports.runUpkeepNow = onCall(UPKEEP_CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requireMaster(caller);
  return { ok: true, run: await runScheduledUpkeep('manual') };
});
