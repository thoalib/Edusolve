const CACHE_NAME = 'edusolve-v2';
const STATIC_ASSETS = ['/', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim(); // Claim control immediately
});

self.addEventListener('fetch', (event) => {
  // Always go to network for APIs
  if (event.request.url.includes('/api/') || event.request.url.includes('/auth/')) {
    return;
  }
  
  // For HTML pages (navigations), use Network-First strategy
  // This prevents the app from ever getting stuck on an old cached version
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // For other static assets, use Cache-First, falling back to network
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
self.addEventListener('push', function(event) {
    if (event.data) {
        try {
            const data = event.data.json();
            const title = data.title || 'New Notification';
            const options = {
                body: data.message,
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                data: {
                    url: data.url || '/'
                }
            };
            event.waitUntil(self.registration.showNotification(title, options));
        } catch (e) {
            console.error('Error parsing push data', e);
        }
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
