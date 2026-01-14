// sw.js
const CACHE_NAME = 'mybrain-v4';
const ASSETS = ['./', './index.html', './dashboard.html', './vault.html', './css/global.css', './js/ui-shared.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
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

self.addEventListener('fetch', (event) => {
  // ফায়ারবেস এবং বাইরের API ক্যাশ করা যাবে না
  if (event.request.url.includes('googleapis.com') || 
      event.request.url.includes('firebasejs') || 
      event.request.url.includes('cloudinary')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then((networkResponse) => {
        // শুধুমাত্র সাকসেসফুল রিকোয়েস্ট ক্যাশ করো
        if (networkResponse && networkResponse.status === 200) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch(() => {
        // ফেচ ফেইল করলে এরর না দেখিয়ে শান্ত থাকো
        console.log('Offline or fetch failed for:', event.request.url);
        return caches.match('./index.html');
      });
    })
  );
});
