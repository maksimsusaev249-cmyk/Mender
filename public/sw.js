const APP_SW_VERSION = 'v7.5.0-lite-b10';
const CACHE_NAME = `mender-offline-shell-${APP_SW_VERSION}`;
const RUNTIME_CACHE = `mender-runtime-${APP_SW_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192.png',
  '/pwa-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CORE_ASSETS.map(url =>
          fetch(url, { cache: 'no-cache' })
            .then(res => (res && res.ok ? cache.put(url, res) : undefined))
            .catch(() => cache.add(url))
        )
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'MENDER_SW_UPDATED', version: APP_SW_VERSION });
        });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache dynamic API endpoints, Vite dev modules, Firebase Auth/Firestore streams, Storage uploads, or TURN requests
  if (
    (url.origin === self.location.origin &&
      (url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/src/') ||
        url.pathname.startsWith('/@') ||
        url.pathname.startsWith('/node_modules/'))) ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebasestorage.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('rtc.live.cloudflare.com')
  ) {
    return;
  }

  // SPA Navigation fallback: Network first (no HTTP cache), fallback to cached /index.html when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(request.url, { cache: 'no-cache' }))
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          return caches.match('/');
        })
    );
    return;
  }

  // Always prefer network for manifest/version metadata so users see updates immediately
  if (
    url.origin === self.location.origin &&
    (url.pathname === '/manifest.json' || url.pathname === '/apk-build-info.json')
  ) {
    event.respondWith(
      fetch(new Request(request.url, { cache: 'no-cache' }))
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Hashed Vite static assets (/assets/*) and fonts: Cache-first with background revalidation
  if (
    (url.origin === self.location.origin &&
      (url.pathname.startsWith('/assets/') ||
        request.destination === 'image' ||
        request.destination === 'font')) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request)
          .then(response => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});
