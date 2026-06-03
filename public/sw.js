/*
 * CRYPT — service-worker KILL SWITCH.
 *
 * The previous offline-shell SW stale-cached clients across deploys, which is a
 * liability during a fast-iterating alpha (testers kept seeing old builds).
 * This version does the opposite: it deletes every cache and unregisters itself
 * on activation, so any browser that previously installed the old SW is freed
 * and always fetches the latest deploy. Registration is also removed from
 * index.html, so no new SW installs.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    })()
  );
});

// Pass everything straight to the network — never serve from cache.
self.addEventListener("fetch", () => {});
