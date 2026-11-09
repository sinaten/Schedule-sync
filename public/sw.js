// Minimal service worker so the site can be installed as an app. It caches nothing on purpose: every page and every piece of data comes from the server, so signed-in content is never stored on the phone by the worker.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
