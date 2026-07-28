# Firestore Rules Emulator tests

Run the complete isolated suite with:

```bash
npm ci
npm run test:rules
```

`test:rules` starts only the local Firestore Emulator with the demo project ID
`demo-floorstock-rules`. The Firebase CLI refuses non-emulated service access for
demo project IDs, so the tests cannot read or modify production data.

The suite seeds synthetic profiles for anonymous, inactive, department,
department controlled custodian, pharmacy staff, inpatient supervisor,
controlled pharmacy, warehouse, pharmacy director, and master contexts. It
covers the current `floorstock_state` key inventory plus `users`,
`system/master`, `audit_logs`, public QR collections, legacy crash-cart QR data,
cloud backups, and the default-deny fallback.

## Crash-cart seal correction boundary

The application exposes the correction action only through two independent
`actualMaster()` checks and records `crash_cart_master_seal_correction` without
an opening-log event. The Emulator verifies that the master can persist the
underlying `crash_carts` state and that pharmacy staff retain their required
regular crash-cart access without receiving user-management, legacy public
crash-cart, or backup privileges.

Firestore Rules cannot distinguish a seal-only correction from an ordinary
crash-cart update while all carts remain an array in
`floorstock_state/crash_carts`. Enforcing that semantic boundary against a
custom direct Firestore client requires moving each cart to its own document or
routing all crash-cart mutations through trusted Cloud Functions. This suite
documents that architectural boundary instead of pretending the monolithic
state rules can enforce it.
