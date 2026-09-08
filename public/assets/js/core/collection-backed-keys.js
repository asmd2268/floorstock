/* State keys that are stored as a collection of documents rather than as one
   array inside a single floorstock_state document.

   A floorstock_state document is capped at 1 MiB and Firestore does not degrade
   as that cap approaches: writes succeed until one is refused outright. Any key
   whose contents grow with use — one row per event, forever — eventually meets
   that wall. Splitting such a key into one document per row removes the ceiling,
   because the cap then applies per row.

   crash_cart_reports was converted first, by hand, which left ~90 lines of
   listener, REST-poll, scope-filter and teardown code in the state module that
   named that one key throughout. The shape is described once here and the state
   module loops over this registry, so another such key is one entry rather than
   another copy.

   Note which keys do NOT belong here. Firestore charges per DOCUMENT read, so
   one document per row is the right shape only when the collection stays small.
   A ledger retained for five years does not: controlled_moves would have reached
   ~91,000 documents, and loading it once would have cost 1.8x the entire free
   daily read allowance. Those keys are partitioned by Hijri month instead — see
   core/month-partitioned-store.js — which is ~1,500x cheaper to read for the
   same data. crash_cart_reports stays here because a report is written by a
   Cloud Function, read individually, and the collection stays in the hundreds.

   Each spec:
     key         the floorstock_state key the rest of the app still reads via S.g()
     tenantPath  sub-collection name under tenants/{tenantId}/
     legacyPath  top-level collection name for the non-tenant deployment
     sortBy      fields the aggregated array is ordered by, in order of precedence
     strip       fields the document carries that the in-memory row must not, so
                 the array stays byte-identical in shape to the pre-conversion one */

export const COLLECTION_BACKED_KEYS = Object.freeze([
  Object.freeze({
    key: 'crash_cart_reports',
    tenantPath: 'crash_cart_reports',
    legacyPath: 'crash_cart_reports_v2',
    sortBy: ['openedAt', 'id'],
    strip: ['updatedAt', '_migratedAt'],
  }),
]);

export function collectionSpecFor(key) {
  return COLLECTION_BACKED_KEYS.find(spec => spec.key === key) || null;
}

export function collectionBackedKeyNames() {
  return COLLECTION_BACKED_KEYS.map(spec => spec.key);
}

export function collectionPathForSpec(spec, tenantId) {
  const tenant = String(tenantId || '').trim();
  return tenant ? `tenants/${tenant}/${spec.tenantPath}` : spec.legacyPath;
}

/* Strips the storage-only fields and returns the row as the rest of the app
   expects it. Shared by the SDK listener and the REST poll so the two paths
   cannot drift into producing differently-shaped rows. */
export function normalizeCollectionRow(spec, data) {
  const row = Object.assign({}, data || {});
  (spec.strip || []).forEach(field => { delete row[field]; });
  return row;
}

export function sortCollectionRows(spec, rows) {
  const fields = spec.sortBy || ['id'];
  return rows.slice().sort((a, b) => {
    for (const field of fields) {
      const comparison = String((a && a[field]) || '').localeCompare(String((b && b[field]) || ''));
      if (comparison) return comparison;
    }
    return 0;
  });
}

Object.assign(globalThis, {
  COLLECTION_BACKED_KEYS,
  collectionSpecFor,
  collectionBackedKeyNames,
  collectionPathForSpec,
  normalizeCollectionRow,
  sortCollectionRows,
});
