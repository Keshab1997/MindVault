// sw.js
const CACHE_NAME = 'mindvault-v5';
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
  const url = new URL(event.request.url);

  // ক্লাউডিনারি ইমেজ ক্যাশ করার লজিক
  if (url.hostname.includes('cloudinary.com')) {
    event.respondWith(
      caches.open('mindvault-images').then((cache) => {
        return cache.match(event.request).then((response) => {
          return response || fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // শেয়ার টারগেট হ্যান্ডেল করা
  if (event.request.method === 'POST' && event.request.url.includes('dashboard.html')) {
    event.respondWith(Response.redirect('./dashboard.html?shared=true', 303));
    
    event.waitUntil(async function() {
      const formData = await event.request.formData();
      const file = formData.get('shared_image');
      const cache = await caches.open('shared-data');
      await cache.put('shared-image', new Response(file));
    }());
    return;
  }
  
  if (event.request.url.includes('googleapis.com') || 
      event.request.url.includes('firebasejs')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
        return response || fetchPromise;
      });
    })
  );
});
