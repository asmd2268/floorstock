/* Early global placeholders: prevent ReferenceError in modules that reference the
   Firebase handles before initialization has produced them.

   These are declarations, not ownership. The real handles are created and
   published by 03-core-application-firebase-state-auth.js, which is why nothing
   here goes through publishLegacy — the registry now allows a name exactly one
   publisher, and claiming these here would make the owner's publish throw. */
globalThis.FB_APP = window.FB_APP || null;
globalThis.FB_AUTH = window.FB_AUTH || null;
globalThis.FB_DB = window.FB_DB || null;
globalThis.FB_FUNCTIONS = window.FB_FUNCTIONS || null;

export const legacyVariableNames = Object.freeze(["FB_APP", "FB_AUTH", "FB_DB", "FB_FUNCTIONS"]);
export default { FB_APP: globalThis.FB_APP, FB_AUTH: globalThis.FB_AUTH, FB_DB: globalThis.FB_DB, FB_FUNCTIONS: globalThis.FB_FUNCTIONS };
