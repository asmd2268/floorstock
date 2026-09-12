'use strict';

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getAuth } = require('firebase-admin/auth');

const { buildUserClaims } = require('./user-claims');

// Keeps each user's Auth custom claims in sync with their users/{uid}
// Firestore profile. firestore.rules READS THESE CLAIMS — activeUser() and
// role() both branch on request.auth.token.get('role')/.get('active'), so a
// wrong value here silently revokes a real user's access. This block used to
// say the sync was "purely additive", which is how `active: profile.active
// === true` survived review and locked out every department account whose
// profile had no explicit active field.
//
// Token-lag fix: a signed-in client's ID token only carries the claims that
// existed when it was minted, and stays valid for up to ~1 hour regardless
// of what changes server-side afterward. Two things close that gap:
//
// 1. revokeRefreshTokens() below, whenever a profile is deactivated or its
//    role/department/master flag changes. This doesn't invalidate the
//    CURRENT (already-issued) ID token immediately — Firestore's rules
//    engine has no way to check revocation — but it guarantees the client
//    cannot silently mint a FRESH token with the old claims once the current
//    one expires; the next refresh attempt is forced back through a real
//    sign-in, where the new (correct) claims get embedded.
// 2. The client-side self-profile watcher in module 03
//    (startSelfProfileWatch) closes the remaining window: it listens to the
//    signed-in user's own users/{uid} doc in realtime (already readable —
//    firestore.rules allows request.auth.uid == uid) and force-signs-out the
//    session within roughly a second of active/role/deptId/master changing,
//    which is how deactivation already behaves today under the current
//    get()-based rules (permission changes take effect on the very next
//    Firestore call). Together these make a future claims-based rules
//    migration no less safe than the current one, instead of introducing a
//    real up-to-1-hour lag as a regression.
exports.syncUserClaims = onDocumentWritten(
  { document: 'users/{uid}', region: 'us-central1' },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data && event.data.before;
    const after = event.data && event.data.after;
    if (!after || !after.exists) {
      try {
        await getAuth().setCustomUserClaims(uid, null);
        await getAuth().revokeRefreshTokens(uid);
      } catch (error) {
        console.warn('syncUserClaims: failed to clear claims/revoke tokens for deleted user', uid, error);
      }
      return;
    }
    const profile = after.data() || {};
    const claims = buildUserClaims(profile);
    try {
      await getAuth().setCustomUserClaims(uid, claims);
    } catch (error) {
      console.error('syncUserClaims: failed to sync claims for user', uid, error);
    }

    const prev = before && before.exists ? before.data() || {} : null;
    const securitySensitiveChange = !prev
      ? false // first-ever profile write (new user) — nothing to revoke yet
      : prev.active !== profile.active
        || String(prev.role || '') !== claims.role
        || String(prev.deptId || prev.departmentId || '') !== claims.deptId
        || (prev.master === true) !== claims.master;
    if (securitySensitiveChange) {
      try {
        await getAuth().revokeRefreshTokens(uid);
      } catch (error) {
        console.error('syncUserClaims: failed to revoke refresh tokens for user', uid, error);
      }
    }
  },
);
