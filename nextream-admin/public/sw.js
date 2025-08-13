// Kill-switch service worker: immediately unregisters and clears caches
self.addEventListener('install', event => {
	self.skipWaiting();
});

self.addEventListener('activate', event => {
	event.waitUntil((async () => {
		try {
			await self.registration.unregister();
			const cacheNames = await caches.keys();
			await Promise.all(cacheNames.map(name => caches.delete(name)));
			const clientsList = await self.clients.matchAll();
			clientsList.forEach(client => client.navigate(client.url));
		} catch (e) {
			// noop
		}
	})());
});

// Do not intercept any fetches
self.addEventListener('fetch', () => {});


