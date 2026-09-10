import { estimateDocBytes, FIRESTORE_DOC_LIMIT } from './firestore-doc-size.js?v=e36fbcceed';

/* The general answer to "a record filled up and everything stopped".

   Month partitions solved it for records that are a log of dated events. They do
   not solve it for the rest: a merge undo stack, a settings map, a list with no
   usable date. Those were each handled one at a time, after the fact, by whoever
   noticed the gauge — which is how the same failure kept arriving wearing a
   different key's name.

   So no state document has a ceiling any more. A value too large for one
   document is written across `<key>`, `<key>_p2`, `<key>_p3`, … and read back as
   one value. Arrays are split by element and rejoined in order; objects are
   split by top-level entry and merged. Nothing is dropped to make room, and no
   caller changes: this happens inside S.s and S.g.

   The continuation is found without any extra bookkeeping. Parts are only ever
   created when a document is close to full, so a document that is NOT close to
   full cannot have any — the loader probes for `_p2` exactly when the base
   document it just read is large, and a session that holds no large document
   pays nothing. There is no index document to keep in step with reality, and no
   metadata field for the rules to have to allow. */

/* Split at 600 KiB, probe from 400 KiB. The gap matters: every part a writer
   produces is at least 400 KiB, so any document under that threshold is
   provably a whole value and needs no probe. */
export const OVERFLOW_SPLIT_BYTES = 600 * 1024;
export const OVERFLOW_PROBE_BYTES = 400 * 1024;
export const MAX_OVERFLOW_PARTS = 40;

const PART_SUFFIX = /_p(\d+)$/;

export function overflowPartKey(key, part) {
  return (part || 1) <= 1 ? String(key) : `${key}_p${part}`;
}

export function isOverflowPartKey(docId) {
  return PART_SUFFIX.test(String(docId || ''));
}

export function overflowBaseKey(docId) {
  return String(docId || '').replace(PART_SUFFIX, '');
}

/* Two other stores already own a `_pN` suffix: a month partition
   (`controlled_moves_h1447-03_p2`) and the audit trail (`audit_log_2026-09_p2`).
   Each concatenates its own parts, so joining them here as well would return
   every one of those rows twice. A document belonging to one of them is left to
   its owner — the general mechanism covers everything else. */
const MONTH_DOC = /_(?:[gh]\d{4}-\d{2}|\d{4}-\d{2})$/;

function ownedByAnotherStore(key) {
  return MONTH_DOC.test(String(key || ''));
}

/* The part documents of `key` the session currently holds, in order. */
export function overflowPartKeysInCache(key) {
  if (ownedByAnotherStore(key)) return [];
  const cache = (globalThis.S && globalThis.S.cache) || {};
  return Object.keys(cache)
    .filter((name) => overflowBaseKey(name) === String(key) && name !== String(key))
    .sort((a, b) => Number(PART_SUFFIX.exec(a)[1]) - Number(PART_SUFFIX.exec(b)[1]));
}

export function hasOverflowParts(key) {
  return overflowPartKeysInCache(key).length > 0;
}

/* Splits a value into as few documents as fit under the limit. Returns one chunk
   for anything that already fits, so the ordinary write is untouched. */
export function splitForOverflow(value, limit) {
  const cap = limit || OVERFLOW_SPLIT_BYTES;
  if (estimateDocBytes(value) <= cap) return [value];

  if (Array.isArray(value)) {
    const chunks = [[]];
    value.forEach((item) => {
      const current = chunks[chunks.length - 1];
      current.push(item);
      // A single element larger than a document cannot be split further; it is
      // left alone in its own part rather than silently dropped.
      if (current.length > 1 && estimateDocBytes(current) > cap) {
        chunks[chunks.length - 1] = current.slice(0, -1);
        chunks.push([item]);
      }
    });
    return chunks;
  }

  if (value && typeof value === 'object') {
    const chunks = [{}];
    Object.keys(value).forEach((name) => {
      const current = chunks[chunks.length - 1];
      current[name] = value[name];
      if (Object.keys(current).length > 1 && estimateDocBytes(current) > cap) {
        delete current[name];
        chunks.push({ [name]: value[name] });
      }
    });
    return chunks;
  }

  // A single oversized string or number has no seam to split on.
  return [value];
}

/* Rejoins whatever the session holds: the base document plus its parts. */
export function joinOverflowParts(key) {
  const cache = (globalThis.S && globalThis.S.cache) || {};
  const base = cache[String(key)];
  const parts = overflowPartKeysInCache(key).map((name) => cache[name]);
  if (!parts.length) return base;
  if (Array.isArray(base)) return parts.reduce((all, part) => all.concat(Array.isArray(part) ? part : []), base.slice());
  if (base && typeof base === 'object') return parts.reduce((all, part) => Object.assign(all, part || {}), Object.assign({}, base));
  return base;
}

/* True when a document the session just read is large enough that the writer
   could have continued it into a part. Anything smaller provably has none. */
export function mayHaveOverflow(value) {
  return estimateDocBytes(value) >= OVERFLOW_PROBE_BYTES;
}

/* The part ids to probe after a scoped load, given what was actually loaded.
   Called again with the newly loaded parts, so a value spanning many documents
   is walked one round trip at a time and a small one costs nothing. */
export function overflowProbeKeys(cache) {
  const keys = [];
  Object.keys(cache || {}).forEach((name) => {
    if (!mayHaveOverflow(cache[name])) return;
    const match = PART_SUFFIX.exec(name);
    const base = match ? overflowBaseKey(name) : name;
    if (ownedByAnotherStore(base)) return;
    const next = match ? `${base}_p${Number(match[1]) + 1}` : `${name}_p2`;
    if (!Object.prototype.hasOwnProperty.call(cache, next)) keys.push(next);
  });
  return keys;
}

/* Writes a value across as many documents as it needs, and empties the parts it
   no longer needs. Emptied rather than deleted on purpose: deleting a state
   document is master-only, and a department shrinking a record must not fail on
   a permission it was never meant to need. */
export async function writeWithOverflow(key, value, writeDoc) {
  const chunks = splitForOverflow(value);
  if (chunks.length > MAX_OVERFLOW_PARTS) {
    throw new Error(`${key} is too large to store even across ${MAX_OVERFLOW_PARTS} documents.`);
  }
  const existing = overflowPartKeysInCache(key).length;
  for (let index = 0; index < chunks.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await writeDoc(overflowPartKey(key, index + 1), chunks[index]);
  }
  for (let part = chunks.length + 1; part <= existing + 1; part += 1) {
    const name = overflowPartKey(key, part);
    if (!Object.prototype.hasOwnProperty.call((globalThis.S && globalThis.S.cache) || {}, name)) continue;
    // eslint-disable-next-line no-await-in-loop
    await writeDoc(name, Array.isArray(value) ? [] : {});
  }
  return chunks.length;
}

export { FIRESTORE_DOC_LIMIT };

Object.assign(globalThis, {
  OVERFLOW_SPLIT_BYTES,
  OVERFLOW_PROBE_BYTES,
  overflowPartKey,
  isOverflowPartKey,
  overflowBaseKey,
  overflowPartKeysInCache,
  hasOverflowParts,
  splitForOverflow,
  joinOverflowParts,
  overflowProbeKeys,
  writeWithOverflow,
});
