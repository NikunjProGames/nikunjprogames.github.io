const CACHE_NAME = 'pleyz-app-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/offline.html',
  '/site.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || '' };
  }
  const data = payload.data || payload;
  const title = String(data.title || payload.notification?.title || 'PleyZ Games');
  const body = String(data.body || payload.notification?.body || 'There is a new update on PleyZ.');
  const requestedUrl = String(data.url || '/');
  let url = '/';
  try {
    const parsed = new URL(requestedUrl, self.location.origin);
    if (parsed.origin === self.location.origin) url = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {}

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/favicon-96x96.png',
    tag: String(data.tag || 'pleyz-notification'),
    renotify: false,
    data: { url }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existingClient = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existingClient) {
      await existingClient.navigate(targetUrl);
      return existingClient.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('pleyz-app-shell-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
        if (response.ok && (url.pathname === '/' || url.pathname === '/index.html')) {
            await (await caches.open(CACHE_NAME)).put('/', response.clone());
          }
          return response;
        } catch {
          if (url.pathname === '/' || url.pathname === '/index.html') {
            return (await caches.match('/')) || caches.match('/offline.html');
          }
          return caches.match('/offline.html');
        }
      })()
    );
    return;
  }

  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
  }
});
