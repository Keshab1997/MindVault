// sw.js
const CACHE_NAME = 'mybrain-ultra-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './vault.html',
  './css/global.css',
  './css/layout.css',
  './css/style-dash.css',
  './css/dark-mode.css',
  './js/ui-shared.js',
  './js/dashboard/main.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('cloudinary')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
        });
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
