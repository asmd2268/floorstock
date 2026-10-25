/* The warm-boot cache: the last permission-scoped state this account loaded,
   kept in localStorage so the shell can open before the network answers.

   Rules it owns:
   - one entry per account (floorstock_last_cache_v2_<uid>); every other
     account's entry, and the old shared v1 entry that could expose a previous
     session's state, is removed on sign-in;
   - what is restored is only what this profile may read, plus collection-backed
     keys, which are read from their own collections and are in no role's key
     list (dropping them started every session with an empty Crash Cart badge);
   - storage can be missing (a private window, cleared site data): every call
     degrades to "no cache" instead of throwing. */

const PREFIX = 'floorstock_last_cache_v2_';

export function warmCacheKey(uid) {
  const id = String(uid || '').trim();
  return id ? PREFIX + id : '';
}

export function pruneOtherWarmCaches(storage, keepKey) {
  try {
    storage.removeItem('floorstock_last_cache_v1');
    Object.keys(storage).forEach((key) => {
      if (key.indexOf(PREFIX) === 0 && key !== keepKey) storage.removeItem(key);
    });
  } catch (_) { /* storage is unavailable */ }
}

/* allowedKeys: null means "no restriction" (master), else the list the profile
   may read. Returns the parsed, narrowed cache object, or null. */
export function readWarmCache(storage, cacheKey, { allowedKeys, extraKeys = () => [] }) {
  let raw = null;
  try { raw = cacheKey ? storage.getItem(cacheKey) : null; } catch (_) { return null; }
  if (!raw) return null;
  let parsed = JSON.parse(raw);
  const allowed = allowedKeys(parsed);
  if (!allowed) return parsed || {};
  const allowedSet = new Set(allowed.concat(extraKeys()));
  const narrowed = {};
  Object.keys(parsed || {}).forEach((key) => { if (allowedSet.has(key)) narrowed[key] = parsed[key]; });
  return narrowed;
}

export function saveWarmCache(storage, cacheKey, cache, warn = () => {}) {
  try {
    if (cacheKey) storage.setItem(cacheKey, JSON.stringify(cache));
  } catch (error) { warn(error); }
}
