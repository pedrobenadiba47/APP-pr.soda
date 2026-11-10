const CACHE_NAME = 'fitpro-v51';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/modern.css',
  './js/app.js',
  './js/timer.js',
  './js/calendar.js',
  './js/generator.js',
  './js/organizer.js',
  './js/weights.js',
  './js/runner.js',
  './js/users.js',
  './manifest.json',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
