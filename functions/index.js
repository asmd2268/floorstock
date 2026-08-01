'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const auth = getAuth();
const CALLABLE_OPTIONS = {
  region: 'us-central1',
  // Keep monitoring-only until every supported production client is observed
  // sending valid App Check tokens, then deploy with ENFORCE_APP_CHECK=true.
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true'
};

// Keep this list synchronized with the role selector and login validation in R6.65.
const ALLOWED_ROLES = new Set([
  'pharmacy',
  'pharmacy_staff',
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

async function callerProfile(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const snap = await db.collection('users').doc(request.auth.uid).get();
  if (!snap.exists) throw new HttpsError('permission-denied', 'User profile not found.');
  const profile = snap.data();
  if (profile.active === false) throw new HttpsError('permission-denied', 'Account is inactive.');
  return { uid: request.auth.uid, ...profile };
}

function requirePharmacy(profile) {
  if (profile.role !== 'pharmacy') {
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
  const callerTenant = String(caller.tenantId || '');
  const targetTenant = String(target.tenantId || '');
  if (callerTenant !== targetTenant) throw new HttpsError('permission-denied', 'The user belongs to another organization.');
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
    : db.collection('users').where('role', '==', 'pharmacy').where('master', '==', true);
  const snap = await query.get();
  return snap.docs.filter((doc) => {
    const user = doc.data();
    return doc.id !== excludeUid && user.active !== false && user.role === 'pharmacy' && user.master === true;
  }).length;
}

exports.listManagedUsers = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  requirePharmacy(caller);
  const tenantId = String(caller.tenantId || '');
  const snap = tenantId
    ? await db.collection('users').where('tenantId', '==', tenantId).get()
    : await db.collection('users').get();
  return {
    users: snap.docs
      .filter((doc) => tenantId ? doc.data().tenantId === tenantId : !doc.data().tenantId)
      .map((doc) => ({ id: doc.id, ...doc.data() }))
  };
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
  if ((requestedRole === 'department' || requestedRole === 'custodian') && !deptId) {
    throw new HttpsError('invalid-argument', 'Department is required for this role.');
  }
  if (grantMaster && (caller.master !== true || requestedRole !== 'pharmacy')) {
    throw new HttpsError('permission-denied', 'Only a Master may grant Master access to a pharmacy user.');
  }
  if (tenant) {
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
      deptId: (requestedRole === 'department' || requestedRole === 'custodian') ? deptId : null,
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
  if (target.role !== 'pharmacy') {
    throw new HttpsError('failed-precondition', 'Master access can only be assigned to a pharmacy user.');
  }
  if (!master && target.master === true && await countActiveMasters(uid, caller.tenantId || '') < 1) {
    throw new HttpsError('failed-precondition', 'You cannot remove the last active Master.');
  }

  await ref.update({ master, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid });
  await audit(master ? 'master.grant' : 'master.revoke', caller, uid, { email: target.email || null });
  return { ok: true, master };
});

exports.getSaasContext = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);
  const platformAdmin = isPlatformAdmin(request, caller);
  if (!caller.tenantId) {
    return { platformAdmin, subscription: { plan: 'enterprise', status: 'active', features: SAAS_PLANS.enterprise, legacy: true } };
  }
  const snap = await db.collection('tenants').doc(String(caller.tenantId)).get();
  if (!snap.exists) throw new HttpsError('failed-precondition', 'Organization subscription was not found.');
  const tenant = snap.data();
  return { platformAdmin, subscription: { ...tenant, tenantId: snap.id } };
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
    const now = Date.now();
    const periodEnd = Timestamp.fromMillis(now + (trialDays || 30) * 86400000);
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
    const batch = db.batch();batch.set(tenantRef, tenant);batch.set(db.collection('users').doc(owner.uid), profile);await batch.commit();
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
  const caller = await callerProfile(request);requirePlatformAdmin(request, caller);
  const snap = await db.collection('tenants').orderBy('createdAt', 'desc').limit(200).get();
  return { tenants: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});

exports.updateTenantSubscription = onCall(CALLABLE_OPTIONS, async (request) => {
  const caller = await callerProfile(request);requirePlatformAdmin(request, caller);
  const data = request.data || {}, tenantId = String(data.tenantId || ''), plan = String(data.plan || ''), status = String(data.status || '');
  if (!SAAS_PLANS[plan] || !SUBSCRIPTION_STATUSES.has(status)) throw new HttpsError('invalid-argument', 'Invalid plan or status.');
  const ref = db.collection('tenants').doc(tenantId), snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Organization was not found.');
  const changes = { plan, status, features: SAAS_PLANS[plan], updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid };
  if (status === 'active') changes.currentPeriodEnd = Timestamp.fromMillis(Date.now() + 30 * 86400000);
  if (status === 'trialing' && (snap.data().status !== 'trialing' || !subscriptionWritable(snap.data()))) {
    changes.trialEndsAt = Timestamp.fromMillis(Date.now() + 14 * 86400000);
    changes.currentPeriodEnd = changes.trialEndsAt;
  }
  await ref.update(changes);await audit('tenant.subscription.update', caller, null, { tenantId, plan, status });
  return { ok: true };
});
