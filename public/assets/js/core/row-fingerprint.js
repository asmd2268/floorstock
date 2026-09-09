/* A stable identity for a row that arrived without one.

   Rows migrated out of a legacy document sometimes had no id — the deletion
   audit never wrote one, and some old orders predate ids. The migration invented
   one with Math.random(), which meant the SAME row imported twice became two
   different rows: content-identical, id-different, and therefore invisible to
   any repair that matches on id. That is how 202 orders became 830 even after
   the duplicates with matching ids were removed.

   The id is now derived from the row's own content, so importing the same row
   again produces the same id and lands on the row already there instead of
   beside it. And the fingerprint is what a repair matches on to find the copies
   that the random ids already scattered. */

const IGNORED = ['id', 'migratedWithoutDate'];

/* Key order must not change the answer: two objects with the same fields in a
   different order are the same row. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    Object.keys(value).sort().forEach((key) => {
      if (value[key] === undefined) return;
      out[key] = canonical(value[key]);
    });
    return out;
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function stableRowFingerprint(row, ignore) {
  const skip = new Set(ignore || IGNORED);
  const copy = {};
  Object.keys(row || {}).forEach((key) => { if (!skip.has(key)) copy[key] = row[key]; });
  try { return JSON.stringify(canonical(copy)); }
  catch (error) { return null; }
}

/* FNV-1a: short, stable, and dependency-free. Collisions do not lose data here —
   the worst case is two unlike rows sharing an id, so the fingerprint itself is
   what a repair compares; this only has to be stable and short. */
export function stableRowId(prefix, row) {
  const text = stableRowFingerprint(row) || String(Math.random());
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${prefix}_migrated_${hash.toString(36)}`;
}

/* An id this project generated for a row that had none. Only these may be
   matched by content: a row that came with its own id keeps its identity. */
export function isSynthesizedMigrationId(id) {
  return /_migrated_[a-z0-9]+$/i.test(String(id || ''));
}

Object.assign(globalThis, { stableRowFingerprint, stableRowId, isSynthesizedMigrationId });
