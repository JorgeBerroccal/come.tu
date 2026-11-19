// Service worker de Come.Tú: guarda los archivos de la app para que abra rápido
// y con poca señal. Las páginas se piden primero a la red (así cada release
// llega al usuario apenas se publica) y, si no hay conexión, se usa la copia.
const VERSION = 'cometu-v2.0.0';
const ARCHIVOS = [
  './', 'index.html', 'paquete.html', 'donde-comer.html', 'admin.html',
  'reservar.html', 'css/styles.css', 'js/config.js', 'js/contenido.js', 'js/store.js', 'js/ui.js', 'js/admin.js', 'js/reservar.js',
  'img/logo.svg', 'manifest.webmanifest',
  'fonts/fraunces-latin-600-normal.woff2', 'fonts/fraunces-latin-700-normal.woff2',
  'fonts/work-sans-latin-400-normal.woff2', 'fonts/work-sans-latin-500-normal.woff2', 'fonts/work-sans-latin-600-normal.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase y fuentes van directo
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const copia = resp.clone();
        caches.open(VERSION).then(c => c.put(e.request, copia));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
