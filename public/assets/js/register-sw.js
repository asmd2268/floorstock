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
