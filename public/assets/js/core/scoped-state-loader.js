/* How a role that cannot LIST the state collection loads its state: it names each
   document and asks for it one at a time, tolerating the ones it is not allowed.
   The three loaders took their collaborators from the state/auth module's scope;
   here they are passed in, so the invariants below can be tested with fakes.

   The invariant that matters most: the keys a poll loads are the same list the
   realtime listeners subscribe to (`keysForProfile`). A poll applies its result by
   DELETING every key it did not return, so a loader that asked for fewer keys than
   the listeners wiped what they had just delivered, and a badge counting pending
   custody rows went 2, 0, 2, 0 in front of the pharmacist. */

const OVERFLOW_PROBE_ROUNDS = 8;
const DEPARTMENT_SCOPED_ROLES = ['department', 'outpatient_pharmacy_supervisor'];

export function createScopedStateLoader({
  overflowProbeKeys,
  scopeCache,
  keysForProfile,
  pharmacyFallbackKeys,
  controlledFallbackKeys,
  controlledDeptKeys,
  pharmacyDeptKeys,
}) {
  const present = (value) => value !== null && value !== undefined;

  /* A scoped session may legitimately be denied one optional document. Do not
     discard every permitted document (especially crash_carts) because of it. */
  async function loadScoped(keys, loader, source, profile) {
    const results = await Promise.allSettled(keys.map((key) => loader(key)));
    const cache = {};
    const failedKeys = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && present(result.value)) cache[keys[index]] = result.value;
      else if (result.status === 'rejected') {
        failedKeys.push(keys[index]);
        console.warn('Scoped state document was unavailable:', keys[index], result.reason);
      }
    });
    /* A value too large for one document continues into <key>_p2, <key>_p3, ... A
       scoped session cannot list the collection, so it asks for continuations only
       when a document it just read is large enough to have been continued. */
    for (let round = 0; round < OVERFLOW_PROBE_ROUNDS; round += 1) {
      const probes = overflowProbeKeys(cache);
      if (!probes.length) break;
      // eslint-disable-next-line no-await-in-loop
      const extra = await Promise.allSettled(probes.map((key) => loader(key)));
      let found = false;
      extra.forEach((result, index) => {
        if (result.status === 'fulfilled' && present(result.value)) { cache[probes[index]] = result.value; found = true; }
      });
      if (!found) break;
    }
    if (profile && DEPARTMENT_SCOPED_ROLES.includes(String(profile.role || ''))) {
      Object.defineProperty(cache, '__scopedDepartmentState', { value: true, enumerable: false, configurable: true });
    }
    return { cache: scopeCache(cache, profile), source, failedKeys };
  }

  async function loadControlledPharmacy(profile, loader, source) {
    // The same one list the listeners use: the ledger and audit months are part of
    // this role's state, and a poll that omitted them deleted them from the cache.
    const initial = await loadScoped(keysForProfile(profile) || controlledFallbackKeys(), loader, source, profile);
    const deptKeys = controlledDeptKeys(initial.cache);
    if (!deptKeys.length) return initial;
    const dynamic = await loadScoped(deptKeys, loader, source, profile);
    Object.assign(initial.cache, dynamic.cache);
    initial.failedKeys = (initial.failedKeys || []).concat(dynamic.failedKeys || []);
    return initial;
  }

  /* The per-department keys can only be listed once `departments` is known, but
     that never required the other static keys first: fetch `departments` alone
     (one small document), then fire the rest of the static wave and the
     department wave together, instead of two sequential waves on a cold login. */
  async function loadPharmacy(profile, loader, source) {
    const deptOnly = await loadScoped(['departments'], loader, source, profile);
    const restKeys = (keysForProfile(profile) || pharmacyFallbackKeys()).filter((key) => key !== 'departments');
    const dynamicKeys = pharmacyDeptKeys(deptOnly.cache, profile);
    const pair = await Promise.all([
      loadScoped(restKeys, loader, source, profile),
      dynamicKeys.length ? loadScoped(dynamicKeys, loader, source, profile) : Promise.resolve({ cache: {}, failedKeys: [] }),
    ]);
    return {
      cache: Object.assign({}, deptOnly.cache, pair[0].cache, pair[1].cache),
      source,
      failedKeys: (deptOnly.failedKeys || []).concat(pair[0].failedKeys || [], pair[1].failedKeys || []),
    };
  }

  return { loadScoped, loadControlledPharmacy, loadPharmacy };
}
