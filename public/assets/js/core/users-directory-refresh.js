/* The users directory is not part of the state collection: it is read through the
   canonical directory callable (a direct listener cannot include legacy users and
   emptied the Users page), so it is refreshed on its own, by the 30s timer on the
   realtime path and after every REST poll.

   Both used to carry their own copy of the same two decisions, which is how they
   drift apart:
   - who may manage users at all: master, pharmacy, pharmacy director;
   - when a refresh redraws the screen: only if the list actually changed AND the
     Users page is the one on screen (a redraw of any other page is wasted work). */

const MANAGER_ROLES = ['pharmacy', 'pharmacy_director'];

export function canManageUsers(profile) {
  return !!(profile && (profile.master === true || MANAGER_ROLES.indexOf(profile.role) >= 0));
}

/* loadUsers() resolves to the new list and also stores it in the cache. */
export async function refreshUsersDirectory({ cache, loadUsers, valuesEqual, usersPageActive, scheduleRefresh }) {
  const before = cache.users || [];
  const users = await loadUsers();
  if (!valuesEqual(before, users || []) && usersPageActive()) scheduleRefresh();
}

/* The directory itself. The callable is authoritative: it merges the current
   /users collection with the legacy directory and Authentication-backed records,
   without depending on client list rules. It is not raced against a direct
   Firestore query, because an empty direct query could overwrite a valid legacy
   directory before the callable returned.

   If the callable fails, a read-only fallback is used. And a refresh that comes
   back EMPTY while a populated list is already held is treated as a failed read,
   not as "everyone was deleted": a transient network or callable problem must never
   blank a populated Users screen during the 30s refresh cycle. */
export async function resolveUserDirectory({ previous, viaCallable, viaFallback, warn = () => {} }) {
  const held = Array.isArray(previous) ? previous : [];
  let users;
  try {
    users = await viaCallable();
  } catch (callableError) {
    warn('Managed-user directory callable was unavailable; using a read-only fallback.', callableError);
    users = await viaFallback();
  }
  if (Array.isArray(users) && users.length === 0 && held.length) {
    warn('Managed-user directory refresh returned no records; retaining the last verified directory.');
    return held;
  }
  return Array.isArray(users) ? users : [];
}
