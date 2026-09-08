# FloorStock architecture boundaries

## Runtime layers

1. `public/assets/js/core/` contains reusable, side-effect-light policies, state
   adapters, render helpers, and security boundaries. Core modules must not
   import feature modules.
2. `public/assets/js/modules/` contains feature behavior and page integration.
   A feature may depend on core modules and on the public contracts of earlier
   features, but must not reach into another feature's private variables.
3. `public/assets/js/main.js` is the single import entrypoint and the single
   source of truth for import order — it is maintained source, not build
   output. Do not add a second entrypoint and do not reintroduce a parallel
   manifest of the same order; `module-manifest.json` and the one-time
   IIFE->ESM converter were deleted after the manifest drifted to 28 entries
   against main.js's 50. Run `npm run stamp` after editing it: that stamps the
   cache-busting hashes and regenerates the root `index.html` mirror.
4. `public/assets/js/core/legacy-registry.js` is a compatibility boundary only.
   New code must not add legacy globals. Existing globals should be migrated to
   explicit exports before their legacy publication is removed.
   `publishLegacy()` throws if a module publishes a name another module already
   published. A name has exactly one owner; to reuse someone else's function,
   import their export. Re-publishing it is what produced the `canonicalX` alias
   plus pass-through wrappers that were removed, and is now a startup error.
   `tests/legacy-publish-ownership.test.js` reproduces the rule statically.
5. State that grows one row per event does not belong in a `floorstock_state`
   document: those are capped at 1 MiB and Firestore refuses the write that
   crosses it rather than degrading. Such keys are registered in
   `core/collection-backed-keys.js` and stored one document per row
   (`crash_cart_reports`, `controlled_moves`). The listener, REST poll and
   teardown are generic over that registry — do not hand-write a second copy for
   a new key. Writes go through a document-shaped store
   (`core/controlled-moves-store.js`, `saveCrashReport`/`deleteCrashReport`), not
   a whole-array save.
6. The REST and SDK transports both stay — REST is the Safari cold-start path and
   the SDK-failure fallback — but the choice between them is made in exactly one
   place, `core/state-transport.js`. Feature modules never name a transport.
7. Archiving must not remove data from the statistics. An archived month is one
   aggregate row carrying `requestCount`, `zeroDispenseCount`, `serviceCounts`
   and both medicine line sets, and `analytics-engine.js` weighs it by
   `rowWeight()`, so archiving changes a report's resolution and never its
   totals. `controlled_moves` retention has a five-year regulatory floor.

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
