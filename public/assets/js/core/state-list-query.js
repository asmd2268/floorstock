/* Loading the whole state collection without the documents nobody reads at login.

   A Master or pharmacy account has no key list, so login read every document in
   the collection, 300 to a page, one page after the next. The bulk of that was
   the inventory safety snapshots: two documents per snapshot, ten snapshots per
   department, each a full copy of a department's medicine list (165 documents,
   about two thirds of everything downloaded). They are read only when a snapshot
   is restored, and then by key.

   Firestore's list call cannot leave documents out, but a query can. Document
   names sort bytewise, so "everything except the snapshots" is three name ranges,
   and a query returns its whole range in one response instead of in pages. The
   three run side by side.

   The index documents (inventory_snapshot_index_<dept>) are not snapshots: they
   hold the list the restore screen shows, and stay in. */

export const ON_DEMAND_PREFIX = 'inventory_snapshot_';
const INDEX_PREFIX = 'inventory_snapshot_index_';

export function isOnDemandStateKey(key) {
  const text = String(key || '');
  return text.startsWith(ON_DEMAND_PREFIX) && !text.startsWith(INDEX_PREFIX);
}

/* The smallest string that sorts after every string starting with `prefix`:
   the prefix with its last character raised by one. */
function afterPrefix(prefix) {
  return prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
}

/* [lowInclusive, highExclusive] pairs over document ids; null is unbounded. */
export const KEPT_RANGES = Object.freeze([
  [null, ON_DEMAND_PREFIX],
  [INDEX_PREFIX, afterPrefix(INDEX_PREFIX)],
  [afterPrefix(ON_DEMAND_PREFIX), null],
]);

function resourceRoot(restBase) {
  return String(restBase).replace(/^https?:\/\/[^/]+\/v1\//, '');
}

export function stateRunQueries(restBase, collectionPath, apiKey) {
  const parts = String(collectionPath).split('/').filter(Boolean);
  const collectionId = parts[parts.length - 1];
  const parent = parts.slice(0, -1).join('/');
  const root = resourceRoot(restBase);
  const ref = (id) => ({ referenceValue: `${root}/${collectionPath}/${id}` });
  const url = `${restBase}${parent ? '/' + parent.split('/').map(encodeURIComponent).join('/') : ''}:runQuery`
    + (apiKey ? `?key=${encodeURIComponent(apiKey)}` : '');
  return KEPT_RANGES.map(([low, high]) => {
    const filters = [];
    if (low !== null) filters.push({ fieldFilter: { field: { fieldPath: '__name__' }, op: 'GREATER_THAN_OR_EQUAL', value: ref(low) } });
    if (high !== null) filters.push({ fieldFilter: { field: { fieldPath: '__name__' }, op: 'LESS_THAN', value: ref(high) } });
    const where = filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } };
    return { url, body: { structuredQuery: { from: [{ collectionId }], where } } };
  });
}

/* runQuery answers with an array of { document, readTime }; a range that matched
   nothing comes back as a single { readTime } with no document. */
export function documentsFromRunQuery(payload) {
  const rows = Array.isArray(payload) ? payload : [];
  return rows.filter((row) => row && row.document).map((row) => row.document);
}
