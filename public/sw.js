/*
 * CRYPT · Crypt Legends — minimal offline-shell service worker (hand-rolled;
 * vite-plugin-pwa is not a dependency). Goals are intentionally narrow:
 *   1. Let the app boot when offline (cache the navigation shell).
 *   2. Never serve stale API / match-server data — only same-origin GET app
 *      assets are cached, and navigations are network-first.
 * This file lives in /public so Vite copies it to the build root verbatim; it is
 * served from the origin root so its scope covers the whole app.
 */
const CACHE = "crypt-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET, same-origin requests are eligible. Anything cross-origin (the
  // match server, RPC, OpenSea, etc.) always goes straight to the network so we
  // never cache or stale live/authoritative data.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Navigations: network-first so the freshest shell wins; fall back to the
  // cached shell when offline so the app still launches.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets (JS/CSS/img): cache-first, then populate cache on miss.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
    )
  );
});
