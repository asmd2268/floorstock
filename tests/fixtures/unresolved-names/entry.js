/* Fixture for tests/unresolved-names.test.js: a module that calls a helper which
   moved out from under it. This is the exact shape of the two ReferenceErrors
   that shipped, kept here so the guard itself stays honest. */
import { keptHelper } from './helper.js';

export function render(value) {
  // `keptHelper` was imported; `helperThatMovedAway` was not — and is defined nowhere.
  return keptHelper(value) + helperThatMovedAway(value);
}

/* A typeof question about an optional global must NOT be reported. */
export function optional() {
  return typeof someOptionalGlobal === 'function' ? someOptionalGlobal() : '';
}
