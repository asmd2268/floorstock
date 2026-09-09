/* The one list of state keys stored as month partitions, and the one function
   that maps a partition document back to the key it belongs to.

   A partition is not a new kind of record. `dept_notes_g2026-09` holds exactly
   the notes that `dept_notes` used to hold, so every permission question about
   it has the same answer as the base key — and that has to be stated once.
   Before this, each partitioned key was spelled out again at every rule site as
   `requests(_g\d{4}-\d{2}(_p\d+)?)?`, once in firestore.rules and once in
   role-capabilities.js. Eight keys times a dozen sites is where a permission
   silently goes missing, which is exactly how the double-escaped `\\d` bug got
   in: the pattern was right in one copy and wrong in another.

   So: callers normalise the document id through baseStateKey() and then ask the
   question they always asked. firestore.rules carries the same list in its own
   stateKey() helper — the two are kept identical by
   tests/partitioned-key-names.test.js, which fails if a key is added to one and
   not the other. */

export const PARTITIONED_STATE_KEYS = Object.freeze([
  // Hijri months — the regulated registers, kept the way the pharmacy reports them.
  'controlled_moves',
  'accountability_usage_v2',
  'controlled_pdf_receipts',
  'accountability_receipts_v2',
  // Gregorian months — operational records, kept the way the wards schedule.
  'requests',
  'dept_notes',
  'deleted_request_audit_v4',
  'department_request_notifications_v1',
  'user_activity_daily_v1',
]);

const PARTITION_SUFFIX = /_[gh]\d{4}-\d{2}(_p\d+)?$/;
/* A value too large for one document continues into <key>_p2, <key>_p3, … Those
   are the same record as <key> and carry the same permissions, for the same
   reason a month partition does — so the suffix is stripped here as well and
   every rule stays written about the key itself. */
const OVERFLOW_SUFFIX = /_p\d+$/;

/* The logical key a state document belongs to: the id itself for a plain
   document, the base key for one of the partitions above. An id that merely
   looks like a partition of something unregistered — an inventory snapshot, say —
   is returned untouched, so nothing inherits permissions by accident. */
export function baseStateKey(docId) {
  const id = String(docId || '');
  const partitioned = id.replace(PARTITION_SUFFIX, '');
  if (partitioned !== id && PARTITIONED_STATE_KEYS.includes(partitioned)) return partitioned;
  const spread = id.replace(OVERFLOW_SUFFIX, '');
  return spread !== id ? spread : id;
}

export function isPartitionedStateKey(key) {
  return PARTITIONED_STATE_KEYS.includes(String(key || ''));
}

Object.assign(globalThis, { PARTITIONED_STATE_KEYS, baseStateKey, isPartitionedStateKey });
