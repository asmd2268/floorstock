/* FloorStock Service Worker — caching + offline shell */
const CACHE = 'floorstock-v1';
const SHELL = [
  '/',
  '/index.html'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) { return cache.addAll(SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

/* Network-first for JS/CSS (always fresh), cache-first for fonts/images */
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* Always go to network for Firebase, Firestore, Functions */
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('cloudfunctions.net')) return;

  /* Network-first for app JS/CSS so updates ship immediately */
  if (url.pathname.startsWith('/assets/js') || url.pathname.startsWith('/assets/css')) {
    event.respondWith(
      fetch(req).catch(function() { return caches.match(req); })
    );
    return;
  }

  /* Cache-first for everything else (fonts, icons, HTML shell) */
  event.respondWith(
    caches.match(req).then(function(cached) {
      return cached || fetch(req).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE).then(function(cache) { cache.put(req, clone); });
        return resp;
      });
    })
  );
});
