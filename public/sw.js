// Service worker de menu-semanal: guarda la app en caché para que funcione sin conexión.
// Al cambiar cualquier archivo de la lista hay que subir VERSION: así se crea una
// caché nueva y la anterior se borra al activarse.

const VERSION = '1.2.0';
const CACHE_PREFIX = 'menu-semanal-';
const CACHE = `${CACHE_PREFIX}${VERSION}`;
// Carpeta de la app: «/» con su servidor o, dentro del portfolio, «/demos/menu-semanal/».
// Las rutas de APP_SHELL son relativas a esta carpeta.
const SCOPE = new URL('./', self.location).pathname;

const APP_SHELL = [
  './',
  './offline.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/dom.js',
  './js/install.js',
  './js/seed.js',
  './js/store.js',
  './js/lib/catalog.js',
  './js/lib/shopping.js',
  './js/lib/text.js',
  './js/lib/units.js',
  './js/lib/validate.js',
  './js/views/data.js',
  './js/views/plan.js',
  './js/views/recipes.js',
  './js/views/shopping.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // `reload` evita que la caché HTTP del navegador cuele una versión vieja.
      cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// La página pide activar la versión nueva cuando el usuario pulsa «Actualizar».
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Solo lo de esta app: dentro del portfolio, el resto de la web no pasa por aquí.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url));
    return;
  }
  event.respondWith(cacheFirst(request));
});

/**
 * Navegaciones: la app es una sola página, así que la portada sale siempre de la caché
 * (arranca al instante aunque no haya red o la red sea muy lenta). Otras páginas
 * van a la red y, sin conexión, a la página de «Sin conexión».
 */
async function handleNavigation(request, url) {
  const cache = await caches.open(CACHE);
  if (url.pathname === SCOPE || url.pathname === `${SCOPE}index.html`) {
    const shell = await cache.match('./');
    if (shell) return shell;
  }
  try {
    return await fetch(request);
  } catch {
    return (await cache.match(url.pathname)) ?? (await cache.match('./offline.html')) ?? Response.error();
  }
}

/**
 * Recursos: primero la caché de esta versión; si no están, la red (sin guardar nada:
 * solo se cachea la lista de APP_SHELL). Se busca solo en la caché propia y no con
 * caches.match(), que mira todas las cachés del dominio (las del portfolio también).
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch {
    return Response.error();
  }
}
