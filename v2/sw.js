/* Guarda la app en el teléfono para que abra aunque no haya señal.
   Los datos siguen viniendo de Firebase cuando hay conexión. */

const CACHE = 'pes6-v2-10';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './logo.png',
  './css/app.css',
  './js/app.js',
  './js/config.js',
  './js/core/store.js',
  './js/core/auth.js',
  './js/domain/teams.js',
  './js/domain/engine.js',
  './js/domain/stats.js',
  './js/domain/annual.js',
  './js/ui/ui.js',
  './js/ui/parts.js',
  './js/ui/cards.js',
  './js/ui/router.js',
  './js/views/home.js',
  './js/views/tournament.js',
  './js/views/schedule.js',
  './js/views/history.js',
  './js/views/showcase.js',
  './js/views/stats.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Nunca tocamos la base de datos ni el SDK: siempre en vivo.
  if (/firestore|googleapis|gstatic/.test(url.hostname)) return;
  if (e.request.method !== 'GET') return;

  const sameOrigin = url.origin === location.origin;

  // Lo propio: primero la copia guardada, y se actualiza de fondo.
  if (sameOrigin) {
    e.respondWith(
      caches.match(e.request).then(hit => {
        const fresh = fetch(e.request)
          .then(res => {
            if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      })
    );
    return;
  }

  // Fuentes e íconos de terceros: se guardan la primera vez que se usan.
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        if (res.ok || res.type === 'opaque') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => hit)
    )
  );
});
