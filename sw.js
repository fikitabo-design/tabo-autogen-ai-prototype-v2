
const CACHE_NAME = 'autometagen-v3-offline';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
  'https://cdn.tailwindcss.com'
];

// ESM modules cache
const ESM_CACHE = 'esm-modules-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) => {
        return Promise.all(
          names.filter((name) => name !== CACHE_NAME && name !== ESM_CACHE).map((name) => caches.delete(name))
        );
      }),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Special handling for ESM.sh and Google Fonts to cache them indefinitely
  if (url.origin === 'https://esm.sh' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(ESM_CACHE).then((cache) => {
        return cache.match(request).then((response) => {
          return response || fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for local assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => cachedResponse); // Fallback to cache if network fails

      return cachedResponse || fetchPromise;
    })
  );
});
