// Sanitary Customer PWA Service Worker
const CACHE_NAME = "sanitary-customer-v1";
const STATIC_ASSETS = ["/", "/index.html", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip caching for API, WebSockets, or non-GET requests
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/waste-types") ||
    url.pathname.startsWith("/addresses") ||
    url.pathname.startsWith("/bookings") ||
    url.pathname.startsWith("/payments") ||
    url.pathname.startsWith("/ai") ||
    url.pathname.startsWith("/uploads") ||
    url.pathname.startsWith("/socket.io")
  ) {
    return;
  }

  // Skip non-GET or cross-origin requests
  if (event.request.method !== "GET" || !url.origin.includes(self.location.origin)) {
    return;
  }

  // Network-first with SPA /index.html fallback for navigation
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match("/index.html");
        return (
          cached ||
          new Response("<!doctype html><html><body><h1>Offline</h1></body></html>", {
            headers: { "Content-Type": "text/html" },
          })
        );
      }),
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return (
            cachedResponse ||
            new Response("Resource unavailable offline", {
              status: 503,
              statusText: "Service Unavailable",
            })
          );
        });

      return cachedResponse || fetchPromise;
    }),
  );
});
