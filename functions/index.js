'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const auth = getAuth();

const ALLOWED_ROLES = new Set(['pharmacy', 'department', 'custodian', 'warehouse']);

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

async function countActiveMasters(excludeUid = null) {
  const snap = await db.collection('users')
    .where('role', '==', 'pharmacy')
    .where('master', '==', true)
    .get();
  return snap.docs.filter((d) => d.id !== excludeUid && d.data().active !== false).length;
}

exports.createManagedUser = onCall({ region: 'us-central1' }, async (request) => {
  const caller = await callerProfile(request);
  requirePharmacy(caller);

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
      createdAt: FieldValue.serverTimestamp(),
      createdBy: caller.uid
    };
    await db.collection('users').doc(userRecord.uid).set(profile);
    await audit('user.create', caller, userRecord.uid, { email, role: requestedRole, deptId, master: grantMaster });
    return { user: { ...profile, createdAt: null } };
  } catch (error) {
    if (userRecord) await auth.deleteUser(userRecord.uid).catch(() => {});
    if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'This email already exists.');
    console.error(error);
    throw new HttpsError('internal', 'Could not create the user.');
  }
});

exports.deleteManagedUser = onCall({ region: 'us-central1' }, async (request) => {
  const caller = await callerProfile(request);
  requireMaster(caller);
  const uid = String((request.data || {}).uid || '');
  if (!uid) throw new HttpsError('invalid-argument', 'User ID is required.');
  if (uid === caller.uid) throw new HttpsError('failed-precondition', 'You cannot delete your own account.');

  const targetRef = db.collection('users').doc(uid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new HttpsError('not-found', 'User profile not found.');
  const target = targetSnap.data();
  if (target.master === true && await countActiveMasters(uid) < 1) {
    throw new HttpsError('failed-precondition', 'You cannot delete the last active Master.');
  }

  await auth.deleteUser(uid).catch((error) => {
    if (error.code !== 'auth/user-not-found') throw error;
  });
  await targetRef.delete();
  await audit('user.delete', caller, uid, { email: target.email || null, role: target.role || null, master: target.master === true });
  return { ok: true };
});

exports.setMasterAccess = onCall({ region: 'us-central1' }, async (request) => {
  const caller = await callerProfile(request);
  requireMaster(caller);
  const uid = String((request.data || {}).uid || '');
  const master = (request.data || {}).master === true;
  if (!uid) throw new HttpsError('invalid-argument', 'User ID is required.');
  if (uid === caller.uid && !master) throw new HttpsError('failed-precondition', 'You cannot remove your own Master access.');

  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'User profile not found.');
  const target = snap.data();
  if (target.role !== 'pharmacy') throw new HttpsError('failed-precondition', 'Master access can only be assigned to a pharmacy user.');
  if (!master && target.master === true && await countActiveMasters(uid) < 1) {
    throw new HttpsError('failed-precondition', 'You cannot remove the last active Master.');
  }

  await ref.update({ master, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid });
  await audit(master ? 'master.grant' : 'master.revoke', caller, uid, { email: target.email || null });
  return { ok: true, master };
});
