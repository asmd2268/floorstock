/* Is the single legacy document for this key still there?

   S.g cannot answer that, and asking it was a data-corrupting mistake. Once a
   key is migrated S.g returns the rows JOINED FROM ITS PARTITIONS — still an
   array, so `Array.isArray(S.g(key))` stayed true forever. Every migration
   therefore still looked pending after it had run, and running it again read the
   partition rows and appended them back into the partitions: the same orders,
   twice, then four times. Production went from 202 orders to 1,312 that way.

   The legacy document is the RAW cache entry, and nothing else. When it is gone
   the key has one home and the migration is finished. */

export function legacyStateDoc(key) {
  const cache = globalThis.S && globalThis.S.cache;
  if (!cache) return null;
  const value = cache[String(key)];
  return Array.isArray(value) ? value : null;
}

export function legacyStateDocExists(key) {
  return legacyStateDoc(key) !== null;
}

Object.assign(globalThis, { legacyStateDoc, legacyStateDocExists });
