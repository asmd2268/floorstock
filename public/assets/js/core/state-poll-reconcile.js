/* What a poll does with the cache once it has the new state.

   A poll's result REPLACES the cache: any key the poll did not return is deleted.
   That is right for a document that was removed and wrong for one the poll merely
   failed to read, so the poll first carries over what it could not read, and only
   then applies the result. Getting this wrong made badges and lists blank out for
   one cycle (a badge counting pending custody rows went 2, 0, 2, 0). */

/* Keep the previous value of every key whose read FAILED in this poll. A key that
   came back as null was read successfully and is deliberately gone, so it is not
   carried. Mutates and returns `incoming`. */
export function carryOverFailedKeys(incoming, previous, failedKeys) {
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  (failedKeys || []).forEach((key) => {
    if (!has(incoming, key) && has(previous, key)) incoming[key] = previous[key];
  });
  return incoming;
}

/* A pharmacy-scoped poll that did not get `departments` back cannot name the
   per-department keys it should have read, so it would delete every department's
   data. When the previous cache knew the departments, carry their keys over. */
export function carryOverDepartmentKeys(incoming, previous, departmentKeysFor) {
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  if (has(incoming, 'departments') || !Array.isArray(previous.departments) || !previous.departments.length) return incoming;
  departmentKeysFor(previous).forEach((key) => {
    if (!has(incoming, key) && has(previous, key)) incoming[key] = previous[key];
  });
  return incoming;
}

/* Make `current` equal `next` in place, except `users`, which is loaded by its own
   path. Returns whether anything changed, so an unchanged poll redraws nothing. */
export function applyStateCache(current, next, valuesEqual) {
  let changed = false;
  Object.keys(current).forEach((key) => {
    if (key === 'users') return;
    if (!Object.prototype.hasOwnProperty.call(next, key)) { delete current[key]; changed = true; }
  });
  Object.keys(next).forEach((key) => {
    if (!valuesEqual(current[key], next[key])) changed = true;
    current[key] = next[key];
  });
  return changed;
}
