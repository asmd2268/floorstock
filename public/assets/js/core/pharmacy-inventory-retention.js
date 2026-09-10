/* How long a stock movement is kept before the Master may purge it.

   Every movement is stamped at the moment it is recorded with the date it may
   be removed after (`purgeAfter`), taken from the retention setting in force
   then. The purge itself used to ignore that stamp entirely and re-derive a
   cut-off from whatever the setting says TODAY — so shortening the retention
   period silently reached back and deleted records that had been recorded under
   a promise to keep them longer.

   The rule here is the conservative one: a movement is only purged once BOTH
   its own stamp has passed AND it is older than the window currently set.
   Whichever promise is longer governs, so lengthening the period protects old
   records and shortening it never destroys them retroactively. Records that
   pre-date the stamp fall back to the current window alone.

   Nothing is deleted by this file — it reports what would go, so the person
   confirming can be told a real number. */

export const MIN_PURGE_DAYS = 30;

export function splitForPurge(transactions, { now = Date.now(), purgeDays = 365 } = {}) {
  const cutoff = now - Math.max(MIN_PURGE_DAYS, Number(purgeDays) || 0) * 864e5;
  const keep = [];
  const purge = [];

  (Array.isArray(transactions) ? transactions : []).forEach((txn) => {
    const created = new Date((txn && txn.createdAt) || 0).getTime();
    /* A record with no readable creation date is kept. Its age is unknown, and
       an unknown age is not a reason to destroy a stock record. */
    if (!Number.isFinite(created) || !created) { keep.push(txn); return; }
    const olderThanWindow = created < cutoff;
    const stamp = txn && txn.purgeAfter ? new Date(txn.purgeAfter).getTime() : null;
    const stampPassed = Number.isFinite(stamp) && stamp !== null ? now >= stamp : true;
    if (olderThanWindow && stampPassed) purge.push(txn); else keep.push(txn);
  });

  return { keep, purge };
}

/* The setting itself: a floor, because a retention period of a few days makes
   the movement history unusable for the stock-take it exists to support. */
export function validPurgeDays(value) {
  const days = parseInt(value, 10);
  if (!Number.isFinite(days)) return null;
  return days >= MIN_PURGE_DAYS ? days : null;
}
