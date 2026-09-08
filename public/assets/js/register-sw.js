/* Registers the service worker.
 *
 * This ran as an inline <script> at the end of the body, which the page's own
 * Content-Security-Policy (script-src 'self', no unsafe-inline) blocked on every
 * load, so /sw.js was never registered. Push notifications depend on it:
 * 84-pwa-push-notifications.js awaits navigator.serviceWorker.ready before
 * calling getToken(), and with no registration that promise never settles, so
 * token retrieval hung indefinitely rather than failing. As a same-origin file
 * it is allowed to run.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (error) {
      console.warn('SW registration failed', error);
    });
  });
})();

/* Tells the user when what they are looking at came from the cache.

   The service worker serves the last good document when the network is gone,
   which is what makes the app usable offline — but on screen an offline copy is
   identical to a live one, and someone reading stock numbers cannot tell that
   they may be stale. (It also made a stopped dev server look exactly like a
   running one during development, which cost real debugging time.)

   The banner is driven by connectivity rather than by the response header,
   because a document restored from the browser's own back/forward cache never
   re-enters the worker at all. It appears only while offline and removes itself
   the moment the connection returns. */
(function () {
  var BANNER_ID = 'fs-offline-banner';

  function removeBanner() {
    var node = document.getElementById(BANNER_ID);
    if (node) node.remove();
  }

  function showBanner() {
    if (document.getElementById(BANNER_ID)) return;
    var bar = document.createElement('div');
    bar.id = BANNER_ID;
    bar.setAttribute('role', 'status');
    bar.textContent = 'Offline — showing a saved copy. Figures may be out of date. / غير متصل — تُعرض نسخة محفوظة وقد تكون الأرقام قديمة.';
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:7px 14px;'
      + 'background:#8a5200;color:#fff;font:600 13px/1.45 system-ui,sans-serif;text-align:center;'
      + 'box-shadow:0 1px 6px rgba(0,0,0,.35)';
    (document.body || document.documentElement).appendChild(bar);
  }

  function sync() {
    if (navigator.onLine === false) showBanner();
    else removeBanner();
  }

  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
})();

