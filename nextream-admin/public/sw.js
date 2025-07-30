// This service worker immediately unregisters itself
self.addEventListener('install', function(event) {
  // Skip waiting and immediately activate
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Unregister this service worker
  event.waitUntil(
    self.registration.unregister().then(function() {
      // Clear all caches
      return caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            return caches.delete(cacheName);
          })
        );
      });
    }).then(function() {
      // Force all clients to reload
      return self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.navigate(client.url);
        });
      });
    })
  );
});

// Don't handle any fetch events - let them pass through
self.addEventListener('fetch', function(event) {
  // Do nothing - let the browser handle the request normally
});