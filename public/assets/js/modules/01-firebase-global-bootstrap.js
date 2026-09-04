import { publishLegacy } from '../core/legacy-registry.js?v=babf19f181';

/* Early global aliases: prevent ReferenceError before Firebase initialization. */
globalThis.FB_APP = window.FB_APP||null;
globalThis.FB_AUTH = window.FB_AUTH||null;
globalThis.FB_DB = window.FB_DB||null;
globalThis.FB_FUNCTIONS = window.FB_FUNCTIONS||null;


const __asdhLegacyApi = {
  FB_APP: globalThis.FB_APP,
  FB_AUTH: globalThis.FB_AUTH,
  FB_DB: globalThis.FB_DB,
  FB_FUNCTIONS: globalThis.FB_FUNCTIONS
};
publishLegacy("01-firebase-global-bootstrap.js", __asdhLegacyApi);
export const legacyVariableNames = Object.freeze(["FB_APP", "FB_AUTH", "FB_DB", "FB_FUNCTIONS"]);
export default __asdhLegacyApi;
