/* Sets the debug flag consumed by the production console policy in module 59.
 *
 * This ran as an inline <script> in the head, which the page's own
 * Content-Security-Policy (script-src 'self', no unsafe-inline) blocked on every
 * load. window.__ASDH_DEBUG was therefore always undefined, so that policy took
 * effect unconditionally: console.log/info/debug/trace were replaced with no-ops
 * and warn/error with generic text, even on localhost or with ?debug in the URL.
 * As a same-origin file it is allowed to run.
 *
 * Must stay a classic (non-module) script loaded before the application modules,
 * since module 59 reads the flag while it evaluates.
 */
window.__ASDH_DEBUG =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  new URLSearchParams(location.search).has('debug');
