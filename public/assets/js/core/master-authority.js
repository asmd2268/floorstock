/* Who is Master — decided the same way the database decides it.

   firestore.rules:

     masterClaim() = token has a `role` claim ? token.master == true
                                              : profile doc's master == true

   The browser asked a different question: it read `master` off the users
   document and never looked at the token. So an account whose document says
   master while its claim does not — claims are written by a Cloud Function and
   can lag a document edit, or predate one — got the full Master interface and
   then had every write refused by the rules. The buttons were there; the
   database said no. That is the worst kind of permission bug, because it looks
   like a broken app rather than a missing permission.

   One rule, written once, mirroring the rules text. The claim wins wherever
   claims exist at all; the document is the fallback for an account whose claims
   have never been written. tests/master-authority.test.js holds this function
   and firestore.rules to the same shape. */

export function claimsCarryRole(claims) {
  return !!claims && claims.role !== undefined && claims.role !== null;
}

/* claims  : the decoded custom claims from the ID token (may be null)
   profile : the users/{uid} document (may be null) */
export function resolveMasterFlag(claims, profile) {
  if (claimsCarryRole(claims)) return claims.master === true;
  return !!profile && profile.master === true;
}

/* True when the document promises Master and the token does not deliver it.
   Worth saying out loud: the session is about to run without Master rights and
   the person will otherwise read that as the app failing. */
export function masterClaimIsStale(claims, profile) {
  return !!profile && profile.master === true && claimsCarryRole(claims) && claims.master !== true;
}

/* Reads the flag from a signed-in Firebase user, refreshing the token once when
   the document promises Master and the cached token disagrees — a stale cached
   token is the ordinary cause, and it fixes itself on refresh. */
export async function resolveMasterFromUser(user, profile) {
  if (!user || typeof user.getIdTokenResult !== 'function') return !!profile && profile.master === true;
  let result = await user.getIdTokenResult(false);
  if (masterClaimIsStale(result && result.claims, profile)) {
    result = await user.getIdTokenResult(true);
  }
  return {
    master: resolveMasterFlag(result && result.claims, profile),
    claims: (result && result.claims) || null,
    stale: masterClaimIsStale(result && result.claims, profile),
  };
}

Object.assign(globalThis, { resolveMasterFlag, masterClaimIsStale, claimsCarryRole, resolveMasterFromUser });
