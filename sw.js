// =============================================================================
//  Service worker — exists because Android requires one with a fetch handler
//  before it will offer "Add to home screen". Deliberately minimal.
//
//  Art and audio are cache-first (large, immutable). The app shell is
//  network-first so a code change is never masked by a stale cache; it falls
//  back to cache when offline. That is the whole of it — no offline UI, no
//  background sync, no update prompts.
// =============================================================================

const VERSION = 'ts3-v1';
const SHELL = [
  './',
  './index.html',
  './main.js',
  './config.js',
  './pwa.js',
  './manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL).catch(() => {}))   // a missing file must not abort install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isShell = url => /\.(html|js|json)$/.test(url.pathname) || url.pathname.endsWith('/');

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Leave cross-origin (the three.js CDN) to the network entirely.
  if (url.origin !== self.location.origin) return;

  if (isShell(url)) {
    // network-first
    e.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // cache-first for assets
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(request, copy)).catch(() => {});
      return res;
    }))
  );
});
