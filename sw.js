const CACHE = 'wiji-v9';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (['wiji-worker-backend','open-meteo.com','fonts.google','fonts.gstatic','media.base44.com'].some(h => url.hostname.includes(h))) return;
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(r => { if (r.ok && r.type === 'basic') caches.open(CACHE).then(cc => cc.put(e.request, r.clone())); return r; }).catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)));
});
