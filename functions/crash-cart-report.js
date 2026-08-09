'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { applyCrashCartReport, publicCrashCartPayload } = require('./crash-cart-report-core');

const CALLABLE_OPTIONS = {
  region: 'us-central1',
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};

async function callerProfile(db, request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const snapshot = await db.collection('users').doc(request.auth.uid).get();
  if (!snapshot.exists) throw new HttpsError('permission-denied', 'User profile not found.');
  const profile = snapshot.data() || {};
  if (profile.active === false) throw new HttpsError('permission-denied', 'Account is inactive.');
  if (String(profile.role || '') !== 'department') {
    throw new HttpsError('permission-denied', 'Only a department employee can submit this report.');
  }
  const departmentId = String(profile.deptId || profile.departmentId || '').trim();
  if (!departmentId) throw new HttpsError('failed-precondition', 'The account is not linked to a department.');
  return { ...profile, uid: request.auth.uid, departmentId };
}

async function assertWritableTenant(db, profile) {
  const tenantId = String(profile.tenantId || '').trim();
  if (!tenantId) return null;
  const snapshot = await db.collection('tenants').doc(tenantId).get();
  if (!snapshot.exists) throw new HttpsError('failed-precondition', 'Organization subscription was not found.');
  const tenant = snapshot.data() || {};
  if (!['active', 'trialing'].includes(String(tenant.status || ''))) {
    throw new HttpsError('failed-precondition', 'The organization subscription is read-only.');
  }
  const periodEnd = tenant.currentPeriodEnd || tenant.trialEndsAt;
  if (periodEnd && typeof periodEnd.toMillis === 'function' && periodEnd.toMillis() <= Date.now()) {
    throw new HttpsError('failed-precondition', 'The organization subscription has expired.');
  }
  if (!Array.isArray(tenant.features) || !tenant.features.includes('crash_cart')) {
    throw new HttpsError('failed-precondition', 'Crash Cart reporting is not included in this plan.');
  }
  return tenantId;
}

function stateRefs(db, tenantId) {
  const state = tenantId
    ? db.collection('tenants').doc(tenantId).collection('state')
    : db.collection('floorstock_state');
  const publicCollection = tenantId
    ? db.collection('tenants').doc(tenantId).collection('public_controlled_expiry')
    : db.collection('public_controlled_expiry');
  return {
    carts: state.doc('crash_carts'),
    reports: state.doc('crash_cart_reports'),
    publicCollection,
  };
}

function cleanConsumed(value) {
  if (!Array.isArray(value)) return [];
  return value.map((row) => ({
    itemId: String(row && row.itemId || '').trim(),
    qty: Number(row && row.qty),
    reportedExpiry: String(row && row.reportedExpiry || '').slice(0, 10),
  }));
}

exports.submitDepartmentCrashCartReport = onCall(CALLABLE_OPTIONS, async (request) => {
  const db = getFirestore();
  const profile = await callerProfile(db, request);
  const tenantId = await assertWritableTenant(db, profile);
  const data = request.data || {};
  const cartId = String(data.cartId || '').trim();
  const reason = String(data.reason || '').trim();
  const oldSeal = String(data.oldSeal || '').trim();
  const consumed = cleanConsumed(data.consumed);
  if (!cartId) throw new HttpsError('invalid-argument', 'Crash Cart ID is required.');
  if (!reason) throw new HttpsError('invalid-argument', 'Select a reason for opening the Crash Cart.');

  const actorName = String(profile.displayName || profile.name || profile.email || profile.username || profile.uid);
  const stamp = new Date().toISOString();
  const refs = stateRefs(db, tenantId);
  let result;

  try {
    await db.runTransaction(async (transaction) => {
      const [cartSnapshot, reportSnapshot] = await Promise.all([
        transaction.get(refs.carts),
        transaction.get(refs.reports),
      ]);
      const carts = cartSnapshot.exists && Array.isArray(cartSnapshot.data().value)
        ? cartSnapshot.data().value
        : [];
      const reports = reportSnapshot.exists && Array.isArray(reportSnapshot.data().value)
        ? reportSnapshot.data().value
        : [];
      result = applyCrashCartReport({
        carts,
        reports,
        cartId,
        departmentId: profile.departmentId,
        reason,
        oldSeal,
        consumed,
        actorName,
        stamp,
      });
      const updatedAt = FieldValue.serverTimestamp();
      transaction.set(refs.carts, { value: result.carts, updatedAt }, { merge: false });
      transaction.set(refs.reports, { value: result.reports, updatedAt }, { merge: false });
      transaction.set(
        refs.publicCollection.doc(`crash_${cartId}`),
        { ...publicCrashCartPayload(result.cart), updatedAt },
        { merge: false },
      );
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('submitDepartmentCrashCartReport failed', error);
    const message = String(error && error.message || 'Crash Cart report could not be saved.');
    const code = /not assigned|another department|belongs to another/i.test(message)
      ? 'permission-denied'
      : /not found/i.test(message)
        ? 'not-found'
        : /quantity|medicine|reason|report line|too many/i.test(message)
          ? 'invalid-argument'
          : 'internal';
    throw new HttpsError(code, message);
  }

  db.collection('audit_logs').add({
    action: 'crash_cart_open_report',
    actorUid: profile.uid,
    actorEmail: profile.email || null,
    targetUid: null,
    details: {
      reportId: result.report.id,
      cartId,
      departmentId: profile.departmentId,
      consumedCount: result.report.consumed.length,
      inventoryDeductedAtReport: true,
      publicQrUpdated: true,
    },
    createdAt: FieldValue.serverTimestamp(),
  }).catch((error) => console.warn('Crash Cart report audit could not be saved.', error));

  return {
    ok: true,
    cart: result.cart,
    report: result.report,
    publicQrUpdated: true,
    publicSynced: true,
    updatedExisting: result.updatedExisting,
  };
});
