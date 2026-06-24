const CACHE = 'expense-tracker-v3';
const ASSETS = [
  './',
  './index.html',
  './expenses.html',
  './analytics.html',
  './settings.html',
  './css/main.css',
  './css/charts.css',
  './js/icons.js',
  './js/sync.js',
  './js/app.js',
  './js/auth.js',
  './js/storage.js',
  './js/dashboard.js',
  './js/expenses.js',
  './js/analytics.js',
  './js/settings.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: always try the network so deploys propagate immediately.
// Fall back to cache only when offline. Cross-origin requests (CDNs, the
// GitHub API) are left to the browser so sync is never served stale.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
  );
});
