const CACHE_NAME = "myos-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/logo.svg",
  "/logo.png",
  "/favicon.svg"
];

// Install Event - Pre-cache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching application shell");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-while-revalidate strategy for static resources
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Bypass API calls, keep them pure network with no caching interference unless offline is needed
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Handle static page/asset cache strategies
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request)
          .then((networkResponse) => {
            // Cache successful GET responses of static resources
            if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failure fallback
            return cachedResponse;
          });

        // Return cached version immediately if present, otherwise wait for network
        return cachedResponse || fetchedResponse;
      });
    })
  );
});
