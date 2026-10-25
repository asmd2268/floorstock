/* How a whole-collection snapshot (master and other unrestricted roles) lands in
   the in-memory state cache.

   `skip(id)` names documents that are read from somewhere else and must not be
   overwritten by this listener: the users directory (read through its callable,
   because a direct listener cannot include legacy users and emptied the Users
   page) and collection-backed keys (read from their own collection listeners; a
   legacy state document for the same key must not overwrite them).

   A removed document deletes its key only if the cache holds it. Returns true when
   anything visibly changed, so the caller refreshes the screen once per snapshot
   instead of once per document. */
export function applyStateDocChanges(cache, changes, { skip, valuesEqual }) {
  let changed = false;
  changes.forEach((change) => {
    const key = change.doc.id;
    if (skip(key)) return;
    if (change.type === 'removed') {
      if (Object.prototype.hasOwnProperty.call(cache, key)) { delete cache[key]; changed = true; }
      return;
    }
    const next = change.doc.data().value;
    if (!valuesEqual(cache[key], next)) changed = true;
    cache[key] = next;
  });
  return changed;
}
