const CACHE_NAME = 'pantry-cache-v4';
const CACHE_KEY_PARAMETER = `__${CACHE_NAME.replace(/-/g, '_')}`;
const PRECACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/src/app.js',
  '/favicon.svg',
  '/manifest.webmanifest'
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

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cacheRequest = versionedRequest(event.request);
      const cached = await cache.match(cacheRequest);
      const fetchPromise = fetch(event.request)
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
      return cached || fetchPromise;
    })
  );
});
