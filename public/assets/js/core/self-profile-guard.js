/* Token-lag guard. A signed-in client keeps whatever permissions it started with
   until its ID token expires (up to ~1h), whatever an admin changes meanwhile.
   Watching the person's own profile document and signing them out the moment it
   is deactivated or its role / department / master flag changes closes that gap.

   This decides what a profile snapshot means. Returns null when nothing relevant
   changed, otherwise 'removed', 'deactivated' or 'changed'.

   Master is compared against what the DOCUMENT said at login (documentMaster),
   not against the effective flag, which comes from the token claim. An account
   whose document says Master while its claim has not caught up runs with
   master:false on purpose; comparing the two would read that as "permissions
   changed" and sign the person out on every snapshot, forever. */
export function selfProfileVerdict(snapshotExists, profile, current, fromCache) {
  /* A snapshot answered from the device's own cache, with no document in it, says
     only that this device has not heard from the server yet — on a weak or
     offline connection that is every time. Only the server can say the account is
     gone; signing someone out on the cache's silence reads as "removed". */
  if (!snapshotExists) return fromCache ? null : 'removed';
  const doc = profile || {};
  if (doc.active !== true) return 'deactivated';
  const deptId = doc.deptId != null ? doc.deptId : doc.departmentId;
  const loginMaster = current.documentMaster !== undefined ? current.documentMaster : current.master;
  const changed = String(doc.role || '') !== String(current.role || '')
    || String(deptId || '') !== String(current.deptId || '')
    || !!doc.master !== !!loginMaster;
  return changed ? 'changed' : null;
}
