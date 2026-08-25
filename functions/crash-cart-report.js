'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  applyCrashCartReport,
  acceptCrashCartReport,
  rejectCrashCartReport,
  publicCrashCartPayload,
} = require('./crash-cart-report-core');

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
  return { ...profile, uid: request.auth.uid };
}

async function callerDepartmentProfile(db, request) {
  const profile = await callerProfile(db, request);
  if (String(profile.role || '') !== 'department') {
    throw new HttpsError('permission-denied', 'Only a department employee can submit this report.');
  }
  const departmentId = String(profile.deptId || profile.departmentId || '').trim();
  if (!departmentId) throw new HttpsError('failed-precondition', 'The account is not linked to a department.');
  return { ...profile, departmentId };
}

async function callerPharmacyProfile(db, request) {
  const profile = await callerProfile(db, request);
  const role = String(profile.role || '');
  // crashCart.operate roles: pharmacy, inpatient_supervisor, pharmacy_staff (+ legacy aliases)
  const allowed = [
    'master', 'pharmacy', 'pharmacy_supervisor',
    'inpatient_supervisor', 'inpatient_pharmacy_supervisor', 'inpatient pharmacy supervisor',
    'pharmacy_staff',
  ];
  if (!allowed.includes(role)) {
    throw new HttpsError('permission-denied', 'Only pharmacy staff can accept or reject crash cart reports.');
  }
  return profile;
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
  // Individual report documents — no 1 MB limit, no last-writer-wins race.
  // The legacy path uses a top-level collection to stay outside floorstock_state.
  const reportsCollection = tenantId
    ? db.collection('tenants').doc(tenantId).collection('crash_cart_reports')
    : db.collection('crash_cart_reports_v2');
  return {
    carts: state.doc('crash_carts'),
    reports: state.doc('crash_cart_reports'),
    reportsCollection,
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

function wrapError(error) {
  if (error instanceof HttpsError) throw error;
  const message = String(error && error.message || 'Operation could not be completed.');
  const code = /not assigned|another department|belongs to another/i.test(message)
    ? 'permission-denied'
    : /not found/i.test(message)
      ? 'not-found'
      : /quantity|medicine|reason|report line|too many|pending|accepted|rejected/i.test(message)
        ? 'invalid-argument'
        : 'internal';
  throw new HttpsError(code, message);
}

// Department submits a crash cart report — creates a pending report, no inventory deduction.
exports.submitCrashCartReport = onCall(CALLABLE_OPTIONS, async (request) => {
  const db = getFirestore();
  const profile = await callerDepartmentProfile(db, request);
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
      // Dual-write: also persist the report as an individual collection document.
      // This eliminates the 1 MB state-doc limit and enables per-document reads.
      transaction.set(refs.reportsCollection.doc(result.report.id), {
        ...result.report,
        updatedAt,
      });
    });
  } catch (error) {
    wrapError(error);
  }

  db.collection('audit_logs').add({
    action: 'crash_cart_report_submitted',
    actorUid: profile.uid,
    actorEmail: profile.email || null,
    targetUid: null,
    details: {
      reportId: result.report.id,
      cartId,
      departmentId: profile.departmentId,
      consumedCount: result.report.consumed.length,
      status: 'pending',
    },
    createdAt: FieldValue.serverTimestamp(),
  }).catch((error) => console.warn('Crash Cart report audit could not be saved.', error));

  return {
    ok: true,
    cart: result.cart,
    report: result.report,
    updatedExisting: result.updatedExisting,
  };
});

// Mirrors specific reports from the legacy floorstock_state/crash_cart_reports
// array into the crash_cart_reports_v2 collection. Every crash-cart write path
// that still updates the legacy array directly from the client (pharmacy
// closing an open report, bulk opening/replacement, seal correction) calls
// this right after, so inpatient_supervisor/pharmacy_staff — who only ever
// read the v2 collection — don't end up looking at a report frozen in a
// stale status forever.
exports.syncCrashCartReportsToV2 = onCall(CALLABLE_OPTIONS, async (request) => {
  const db = getFirestore();
  const profile = await callerPharmacyProfile(db, request);
  const tenantId = await assertWritableTenant(db, profile);
  const data = request.data || {};
  const reportIds = Array.isArray(data.reportIds) ? data.reportIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (!reportIds.length) return { ok: true, synced: 0 };

  const refs = stateRefs(db, tenantId);
  const doc = await refs.reports.get();
  const reports = doc.exists && Array.isArray(doc.data().value) ? doc.data().value : [];
  const byId = new Map(reports.map((r) => [String(r && r.id || ''), r]));
  const updatedAt = FieldValue.serverTimestamp();
  const batch = db.batch();
  let synced = 0;
  reportIds.forEach((id) => {
    const report = byId.get(id);
    if (!report) return;
    batch.set(refs.reportsCollection.doc(id), { ...report, updatedAt }, { merge: false });
    synced++;
  });
  if (synced) await batch.commit();
  return { ok: true, synced };
});

// Pharmacy accepts a pending report — executes inventory deduction.
exports.acceptCrashCartReport = onCall(CALLABLE_OPTIONS, async (request) => {
  const db = getFirestore();
  const profile = await callerPharmacyProfile(db, request);
  const tenantId = await assertWritableTenant(db, profile);
  const data = request.data || {};
  const reportId = String(data.reportId || '').trim();
  if (!reportId) throw new HttpsError('invalid-argument', 'Report ID is required.');

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
      result = acceptCrashCartReport({ carts, reports, reportId, actorName, stamp });
      const updatedAt = FieldValue.serverTimestamp();
      transaction.set(refs.carts, { value: result.carts, updatedAt }, { merge: false });
      transaction.set(refs.reports, { value: result.reports, updatedAt }, { merge: false });
      transaction.set(refs.reportsCollection.doc(result.report.id), {
        ...result.report,
        updatedAt,
      });
      transaction.set(
        refs.publicCollection.doc(`crash_${result.cart.id}`),
        { ...publicCrashCartPayload(result.cart), updatedAt },
        { merge: false },
      );
    });
  } catch (error) {
    wrapError(error);
  }

  db.collection('audit_logs').add({
    action: 'crash_cart_report_accepted',
    actorUid: profile.uid,
    actorEmail: profile.email || null,
    targetUid: null,
    details: {
      reportId,
      cartId: result.cart.id,
      inventoryDeductedAt: stamp,
    },
    createdAt: FieldValue.serverTimestamp(),
  }).catch((error) => console.warn('Crash Cart accept audit could not be saved.', error));

  return {
    ok: true,
    cart: result.cart,
    report: result.report,
  };
});

// Pharmacy rejects a pending report — no inventory change.
exports.rejectCrashCartReport = onCall(CALLABLE_OPTIONS, async (request) => {
  const db = getFirestore();
  const profile = await callerPharmacyProfile(db, request);
  const tenantId = await assertWritableTenant(db, profile);
  const data = request.data || {};
  const reportId = String(data.reportId || '').trim();
  const rejectionNote = String(data.rejectionNote || '').trim();
  if (!reportId) throw new HttpsError('invalid-argument', 'Report ID is required.');

  const actorName = String(profile.displayName || profile.name || profile.email || profile.username || profile.uid);
  const stamp = new Date().toISOString();
  const refs = stateRefs(db, tenantId);
  let result;

  try {
    await db.runTransaction(async (transaction) => {
      const reportSnapshot = await transaction.get(refs.reports);
      const reports = reportSnapshot.exists && Array.isArray(reportSnapshot.data().value)
        ? reportSnapshot.data().value
        : [];
      result = rejectCrashCartReport({ reports, reportId, rejectionNote, actorName, stamp });
      const updatedAt = FieldValue.serverTimestamp();
      transaction.set(refs.reports, { value: result.reports, updatedAt }, { merge: false });
      transaction.set(refs.reportsCollection.doc(result.report.id), {
        ...result.report,
        updatedAt,
      });
    });
  } catch (error) {
    wrapError(error);
  }

  db.collection('audit_logs').add({
    action: 'crash_cart_report_rejected',
    actorUid: profile.uid,
    actorEmail: profile.email || null,
    targetUid: null,
    details: {
      reportId,
      rejectionNote: rejectionNote || null,
    },
    createdAt: FieldValue.serverTimestamp(),
  }).catch((error) => console.warn('Crash Cart reject audit could not be saved.', error));

  return {
    ok: true,
    report: result.report,
  };
});
