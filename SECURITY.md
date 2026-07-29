# Security operations

## Firebase App Check rollout

The web client activates App Check with a reCAPTCHA Enterprise provider before
creating Auth and Firestore handles. The reCAPTCHA **site key is public client
configuration**, not the private reCAPTCHA secret. Domain restrictions and the
Firebase App Check registration are the controls that bind it to this app.

Roll out enforcement in this order:

1. Deploy the web client while enforcement remains disabled.
2. Confirm valid App Check traffic in Firebase App Check metrics for every
   supported production domain and browser.
3. Deploy Functions with `ENFORCE_APP_CHECK=true`.
4. Enable enforcement for Cloud Firestore and Cloud Functions in the Firebase
   console during a monitored maintenance window.
5. Verify department, controlled-pharmacy, warehouse, pharmacy-staff, pharmacy,
   and Master sessions. Disable enforcement if legitimate traffic is rejected.

Do not enable enforcement before step 2. The console setting is external
deployment state and is intentionally not changed by repository code.

## State-read boundary

Department sessions no longer list the monolithic `floorstock_state`
collection. They load an explicit allowlist of shared request/configuration
documents plus their own medication, expiry, shelf, and alert documents.
Global controlled, warehouse, crash-cart, audit, and pharmacy-only state is not
readable by a department account. A department controlled custodian additionally
receives only the three controlled documents belonging to its assigned
department.

The client cache is namespaced by Firebase UID, filtered through the same
department allowlist, and caches belonging to other users are removed during
startup. The legacy cross-account cache key is deleted.

Some legacy state remains stored as arrays in single documents. Finer row-level
authorization for shared requests or accountability records requires migrating
those records to per-department documents or routing access through Cloud
Functions; Firestore Rules cannot filter fields inside a permitted document.

## Browser and hosting controls

Firebase Hosting and Vercel both send HSTS, clickjacking protection, MIME
sniffing protection, referrer policy, permissions policy, and CSP headers. The
HTML CSP remains as defense in depth. `style-src 'unsafe-inline'` is retained
temporarily because the current UI contains many generated inline styles; it
must not be removed until those styles are migrated to classes and visually
tested.

The root `index.html` is a generated path-adjusted mirror of
`public/index.html`. `verify_repo.py` fails if the two drift.

## Architectural notes

The legacy registry does not grant server permissions: Cloud Functions and
Firestore Rules remain authoritative. Removing globals is still a long-term
hardening goal, but renaming dated module files or hiding public site keys does
not create a security boundary. Changes to the ordered module loader require a
separate migration with authenticated browser coverage because the modules have
intentional legacy dependencies.
