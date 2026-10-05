const RELEASE_ID = '__PANTRY_RELEASE_ID__';
const CACHE_NAME = `pantry-cache-${RELEASE_ID}`;
const CACHE_KEY_PARAMETER = `__${CACHE_NAME.replace(/-/g, '_')}`;
const SPRITE_PATH = '/assets/pantry-items.__PANTRY_SPRITE_HASH__.png';
const FONT_PATH = '/assets/manrope.__PANTRY_FONT_HASH__.woff2';
const PRECACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/src/app.js',
  '/src/firebase.js',
  '/favicon.svg',
  '/manifest.webmanifest',
  SPRITE_PATH,
  FONT_PATH
];
const versionedRequest = (request) => {
  const url = new URL(request.url);
  url.searchParams.set(CACHE_KEY_PARAMETER, CACHE_NAME);
  return new Request(url);
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(
          PRECACHE.map((path) => versionedRequest(new Request(new URL(path, self.location.origin))))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (!url.protocol.startsWith('http')) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/config.js') return;
  // The browser must fetch the worker script itself from the network so a
  // previously installed worker cannot keep serving its own stale source.
  if (url.pathname === '/sw.js') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cacheRequest = versionedRequest(event.request);
      const cached = await cache.match(cacheRequest);
      const shellRequest =
        event.request.mode === 'navigate' ||
        url.pathname === '/index.html' ||
        url.pathname === '/styles.css' ||
        url.pathname === '/src/app.js' ||
        url.pathname === '/src/firebase.js';
      const fetchPromise = fetch(event.request, shellRequest ? { cache: 'reload' } : undefined)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            cache.put(cacheRequest, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cached);
      // Check the HTML, CSS, and executable bundles on the network first.
      // Their build-derived worker cache and no-cache HTTP headers prevent an
      // installed worker from pinning an older interface; cache is offline fallback.
      if (shellRequest) {
        return (await fetchPromise) || cached;
      }
      return cached || fetchPromise;
    })
  );
});
