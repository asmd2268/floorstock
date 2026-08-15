'use strict';

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getAuth } = require('firebase-admin/auth');

// Phase 2b scaffolding: keeps each user's Auth custom claims in sync with
// their users/{uid} Firestore profile. Purely additive — nothing in
// firestore.rules reads these claims yet, so this cannot change any current
// permission behavior. It only lets a future rules change read role/deptId/
// active/master/tenantId from request.auth.token instead of calling get()
// on the user's own profile document in every single rule.
//
// Important caveat for that future step: a signed-in client's ID token only
// carries the claims that existed at the time the token was minted. After
// this function updates claims, an already-open session keeps using its old
// token (and therefore its old claims) until the client calls
// getIdToken(true) or signs in again — up to the token's ~1 hour lifetime.
// Any rules migration to claims-based reads must account for that lag.
exports.syncUserClaims = onDocumentWritten(
  { document: 'users/{uid}', region: 'us-central1' },
  async (event) => {
    const uid = event.params.uid;
    const after = event.data && event.data.after;
    if (!after || !after.exists) {
      try {
        await getAuth().setCustomUserClaims(uid, null);
      } catch (error) {
        console.warn('syncUserClaims: failed to clear claims for deleted user', uid, error);
      }
      return;
    }
    const profile = after.data() || {};
    const claims = {
      role: String(profile.role || ''),
      deptId: String(profile.deptId || profile.departmentId || ''),
      active: profile.active === true,
      master: profile.master === true,
      tenantId: String(profile.tenantId || ''),
    };
    try {
      await getAuth().setCustomUserClaims(uid, claims);
    } catch (error) {
      console.error('syncUserClaims: failed to sync claims for user', uid, error);
    }
  },
);
