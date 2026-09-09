import { registerAutoMaintenance } from './state-maintenance.js?v=8ef0a9d17f';
import { estimateDocBytes } from './firestore-doc-size.js?v=ed46614d2f';

/* Ceilings that enforce themselves: the newest rows are kept, the oldest give
   way, and no record can grow without end.

   This is deliberately NOT the answer for most of the app, and the difference
   matters. There are two ways a record can be prevented from filling up:

     structural — the record has no ceiling at all. Rows are spread across one
                  document per month, and a month that fills rolls to a numbered
                  part. Nothing is ever dropped. This is what orders, the
                  controlled ledger, custody, notes, the deletion audit and the
                  Crash Cart reports use, because every one of those rows is
                  either a record someone may have to produce or a number a
                  report counts. Dropping the oldest there is not housekeeping,
                  it is destroying evidence — and the controlled register carries
                  a six Hijri year retention floor besides.

     rotation   — the record has a ceiling and the oldest rows are dropped to
                  stay under it. Right only where an old row has no value to
                  anyone: instrumentation, and notices that were delivered long
                  ago. Nothing here is a medical or regulatory record.

   So every key is covered, but not by the same rule. A key registered here
   rotates; every other key is structurally uncapped. The list is short on
   purpose, and each entry says why its old rows may go. */

const policies = new Map();

export function registerRotation(policy) {
  if (!policy || !policy.key || typeof policy.run !== 'function') return;
  if (policies.has(String(policy.key))) throw new Error(`A rotation policy is already registered for ${policy.key}.`);
  policies.set(String(policy.key), Object.freeze(Object.assign({}, policy, { key: String(policy.key) })));
}

export function rotationPolicies() {
  return [...policies.values()];
}

export function rotationPolicyFor(key) {
  return policies.get(String(key)) || null;
}

function rowsFor(key) {
  const value = globalThis.S && typeof globalThis.S.g === 'function' ? globalThis.S.g(key) : null;
  return Array.isArray(value) ? value : null;
}

function timeOf(row, fields) {
  for (const field of fields) {
    const value = row && row[field];
    if (value) return String(value);
  }
  return '';
}

/* Keeps the newest rows that fit both ceilings — an age limit and a size limit —
   and returns what would be dropped, so a caller can report it before writing.
   A row with no readable date is kept: it cannot be judged old, and guessing
   would drop it on the first pass. */
export function rowsToRotate(rows, policy) {
  const dated = (rows || []).map((row, index) => ({ row, index, at: timeOf(row, policy.dateField || ['at']) }));
  const drop = new Set();

  if (policy.maxAgeDays) {
    const cutoff = new Date(Date.now() - policy.maxAgeDays * 86400000).toISOString();
    dated.forEach((entry) => { if (entry.at && entry.at < cutoff) drop.add(entry.index); });
  }

  if (policy.maxBytes) {
    // Newest first, keeping rows while they fit; the rest are the ones to drop.
    const order = dated.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
    let used = 0;
    order.forEach((entry) => {
      if (drop.has(entry.index)) return;
      used += estimateDocBytes(entry.row);
      if (used > policy.maxBytes) drop.add(entry.index);
    });
  }

  return dated.filter((entry) => drop.has(entry.index)).map((entry) => entry.row);
}

export function rotateKey(key) {
  const policy = rotationPolicyFor(key);
  if (!policy) return null;
  const rows = rowsFor(key);
  if (!rows || !rows.length) return null;
  const drop = rowsToRotate(rows, policy);
  if (!drop.length) return null;
  const dropped = new Set(drop.map((row) => row));
  return { policy, kept: rows.filter((row) => !dropped.has(row)), dropped: drop.length };
}

async function enforce(policy) {
  const plan = rotateKey(policy.key);
  if (!plan) return null;
  await globalThis.S.s(policy.key, plan.kept);
  return { key: policy.key, dropped: plan.dropped };
}

/* Instrumentation. One row per user per day, forever, each carrying a map of
   per-icon tap counts. A year is the reporting horizon anybody uses; older rows
   answer no question the app asks. */
registerRotation({
  key: 'user_activity_daily_v1',
  dateField: ['date'],
  maxAgeDays: 400,
  maxBytes: 400 * 1024,
  label: 'Staff activity / نشاط الموظفين',
  why: 'Older than 400 days, and no report reads that far back.',
  run: enforce,
});

/* Delivered notices. A department was told its order was deleted; six months
   later the notice is not a record of anything — the deletion audit is. */
registerRotation({
  key: 'department_request_notifications_v1',
  dateField: ['createdAt'],
  maxAgeDays: 180,
  maxBytes: 300 * 1024,
  label: 'Department notifications / إشعارات الأقسام',
  why: 'Delivered notices older than 180 days; the deletion audit keeps the record itself.',
  run: enforce,
});

rotationPolicies().forEach((policy) => registerAutoMaintenance({
  key: `rotate:${policy.key}`,
  describe: (result) => `${result.dropped} oldest row(s) removed from ${result.key}`,
  run: () => policy.run(policy),
}));

Object.assign(globalThis, { registerRotation, rotationPolicies, rotationPolicyFor, rowsToRotate, rotateKey });
