# FloorStock architecture boundaries

## Runtime layers

1. `public/assets/js/core/` contains reusable, side-effect-light policies, state
   adapters, render helpers, and security boundaries. Core modules must not
   import feature modules.
2. `public/assets/js/modules/` contains feature behavior and page integration.
   A feature may depend on core modules and on the public contracts of earlier
   features, but must not reach into another feature's private variables.
3. `public/assets/js/main.js` is the single import entrypoint. Import order is
   generated from `module-manifest.json`; do not add a second entrypoint.
4. `public/assets/js/core/legacy-registry.js` is a compatibility boundary only.
   New code must not add legacy globals. Existing globals should be migrated to
   explicit exports before their legacy publication is removed.

## Firebase boundaries

- `functions/index.js` owns callable/request handlers and authorization.
- `functions/crash-cart-report.js` owns the Crash Cart callable adapter.
- `functions/*-core.js` contains pure validation/state-transition logic and is
  the preferred place for new tests.
- `firestore.rules` remains the final authorization boundary; client checks are
  convenience checks, never the source of permission.

## Change protocol

Before removing a function or module:

1. Search its exports and all call sites, including `window.*` and the CSP
   bridge.
2. Add or update a regression test for the replacement contract.
3. Run `npm run verify`, `npm run test:ui`, `npm run test:functions`,
   `npm run test:rules`, and `npm run test:browser` on the local server.
4. Keep a tag or backup commit until the next production verification.

The compatibility layer is intentionally retained until this protocol has
been completed for each legacy contract; deleting it wholesale is unsafe.
