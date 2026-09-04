/* FloorStock Service Worker — caching + offline shell
 *
 * The HTML is the version pointer: it carries the content-hashed asset URLs and is
 * served no-store by both hosts precisely so a deploy is always picked up. An
 * earlier revision precached '/' and '/index.html' and served all non-asset
 * requests cache-first, which pinned the document to whatever version happened to
 * be cached first — the app then kept loading the old hashed modules and no
 * reload could recover it. HTML is therefore network-first here, with the cached
 * copy used only when the network fails.
 *
 * Assets are the mirror image: every /assets URL carries a hash of its own bytes
 * (tools/stamp_module_hashes.mjs), so a cached response can never be stale — the
 * URL changes when the content does. Those are cache-first, which is what makes a
 * repeat open cost no network at all.
 */
const CACHE = 'floorstock-v2';
/* Only the document is kept for offline use, and it is refreshed on every
   successful navigation rather than frozen at install time. */
const OFFLINE_DOC = '/index.html';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.add(new Request(OFFLINE_DOC, { cache: 'reload' })).catch(function () {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      // Drops floorstock-v1, whose cached document is what pinned the version.
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isHtmlRequest(request, url) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html') ||
    url.pathname === '/' || url.pathname.endsWith('.html');
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Never interfere with auth, Firestore or callables.
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('cloudfunctions.net') ||
      url.hostname.includes('run.app')) return;

  // Cross-origin (CDN, fonts) is left to the browser's own HTTP cache.
  if (url.origin !== self.location.origin) return;

  if (isHtmlRequest(req, url)) {
    event.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(OFFLINE_DOC, clone); });
        }
        return resp;
      }).catch(function () {
        return caches.match(OFFLINE_DOC).then(function (cached) {
          return cached || Response.error();
        });
      })
    );
    return;
  }

  // Hashed assets: safe to serve from cache, and refilled on a miss.
  if (url.pathname.indexOf('/assets/') === 0 || url.pathname.indexOf('/public/assets/') === 0) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (resp) {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then(function (c) { c.put(req, clone); });
          }
          return resp;
        });
      })
    );
    return;
  }

  // Everything else (icons, manifest, sw-adjacent files): network with a cache
  // fallback, so a deploy is picked up but offline still works.
  event.respondWith(
    fetch(req).catch(function () { return caches.match(req); })
  );
});
