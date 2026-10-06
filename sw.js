/* Service worker: guarda la app en el aparato para que abra al instante y
   sirva sin señal, y avisa cuando hay versión nueva.
   Al publicar una versión nueva SE CAMBIA ESTE NÚMERO. */
const VERSION = 'almacen-2026-10-06-6';
const ARCHIVOS = [
  './', './index.html', './estilos.css', './app.js', './config.js',
  './datos/catalogo.js', './datos/carga-inicial.js', './datos/reglas.js', './datos/busca.js', './datos/almacen.js', './manifest.json',
  './icono.svg', './icono-maskable.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Los archivos de la app: primero la red (así una versión nueva se ve a la primera);
// si no hay señal, la copia guardada. Todo lo demás (la base de datos, letras) va directo a la red.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(resp => {
      if (resp && resp.ok) caches.open(VERSION).then(c => c.put(e.request, resp.clone()));
      return resp;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', e => { if (e.data === 'activa') self.skipWaiting(); });
