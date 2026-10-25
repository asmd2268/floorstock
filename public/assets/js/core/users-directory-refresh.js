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
