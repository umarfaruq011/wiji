/* ============================================================
   WIJI — Service Worker
   Cache-first for static assets, network-first for API
   ============================================================ */

const CACHE_NAME = 'wiji-v8';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './hardware.js',
  './safety.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* Install — cache static assets */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW: some assets failed to cache', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* Activate — clean old caches */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

/* Fetch — cache-first for static, network-first for API */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Skip external APIs (Worker, weather, fonts, maps)
  const externalHosts = [
    'wiji-worker-backend',
    'open-meteo.com',
    'google.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'media.base44.com',
    'maps.google.com'
  ];
  if (externalHosts.some((h) => url.hostname.includes(h))) {
    return; // let browser handle normally
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache successful responses
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* Background sync — for future API retries */
self.addEventListener('sync', (event) => {
  if (event.tag === 'wiji-sync') {
    event.waitUntil(Promise.resolve());
  }
});

/* Push notifications — for future alerts */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'WIJI', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200]
    })
  );
});