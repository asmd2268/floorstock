/* What Firestore actually counts against the 1 MiB document limit.

   The System Health gauge measured JSON.stringify() bytes, which is not what
   Firestore charges: JSON pays for quotes, colons, commas and braces that never
   reach the database. That is a 20-30% overstatement on object-heavy data, and
   it showed as a document reading "1.20 MB · 120.4% of 1 MiB" — a number that
   cannot exist, because Firestore would have refused the write that created it.
   A gauge that cries wolf at 120% teaches a master to ignore it, which is worse
   than having no gauge.

   Firestore's documented accounting (Usage and limits → Storage size):
     document name + 32 bytes of overhead per document
     string        UTF-8 byte length + 1
     number        8, whether integer or double
     boolean       1
     null          1
     timestamp     8
     array         the sum of its elements
     map           for each entry, the key's string size plus the value's size

   The estimate is deliberately of the VALUE a caller is about to write, plus the
   document's own overhead — the same thing the writer can decide on before the
   write leaves the browser. */

export const FIRESTORE_DOC_LIMIT = 1048576;

// Firestore's per-document overhead, plus the {value, updatedAt} envelope every
// state document carries: the two field names and the timestamp.
const DOC_OVERHEAD = 32 + ('value'.length + 1) + ('updatedAt'.length + 1) + 8;

const encoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;

function stringBytes(text) {
  const value = String(text);
  return (encoder ? encoder.encode(value).length : value.length) + 1;
}

export function estimateValueBytes(value) {
  if (value === null || value === undefined) return 1;
  if (typeof value === 'string') return stringBytes(value);
  if (typeof value === 'number') return 8;
  if (typeof value === 'boolean') return 1;
  if (value instanceof Date) return 8;
  if (Array.isArray(value)) {
    let total = 0;
    for (const item of value) total += estimateValueBytes(item);
    return total;
  }
  if (typeof value === 'object') {
    let total = 0;
    for (const key of Object.keys(value)) {
      if (value[key] === undefined) continue;
      total += stringBytes(key) + estimateValueBytes(value[key]);
    }
    return total;
  }
  // Functions and symbols never survive a Firestore write; count nothing.
  return 0;
}

/* What the whole state document would weigh with this value in it. */
export function estimateDocBytes(value) {
  return DOC_OVERHEAD + estimateValueBytes(value);
}

Object.assign(globalThis, {
  FIRESTORE_DOC_LIMIT,
  estimateValueBytes,
  estimateDocBytes,
});
