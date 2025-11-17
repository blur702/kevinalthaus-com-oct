'use strict';

// Legacy service worker cleanup script.
// Serves as a no-op worker that immediately removes itself and clears stale caches.

async function cleanupCaches() {
  if (!self.caches) {
    return;
  }

  const keys = await caches.keys();
  await Promise.all(
    keys.map((key) =>
      caches.delete(key).catch(() => {
        return false;
      })
    )
  );
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function notifyClientsToReload() {
  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  const payload = { type: 'SW_CLEANUP_RELOAD' };

  await Promise.all(
    clientList.map(
      (client) =>
        new Promise((resolve) => {
          try {
            client.postMessage(payload);
          } catch (error) {
            console.warn('[sw-cleanup] postMessage failed', error);
          } finally {
            setTimeout(resolve, 250);
          }
        })
    )
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    cleanupCaches().catch(() => {
      return undefined;
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await cleanupCaches();
        await self.clients.claim();
        await notifyClientsToReload();
        await wait(250);
        await self.registration.unregister();
      } catch (error) {
        console.warn('[sw-cleanup] activate failed', error);
      }
    })()
  );
});

// Explicit fetch handler keeps behavior predictable while cleanup completes.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
