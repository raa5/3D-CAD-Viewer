const CACHE_NAME = "3d-cad-viewer-v2";
const urlsToCache = [
  "/",
  "/upload.html",
  "/style.css",
  "/upload.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// On install: cache core files
self.addEventListener("install", event => {
  console.log("[ServiceWorker] Install");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[ServiceWorker] Caching app shell");
      return cache.addAll(urlsToCache);
    })
  );
});

// On activate: remove old caches
self.addEventListener("activate", event => {
  console.log("[ServiceWorker] Activate");
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log("[ServiceWorker] Deleting old cache:", name);
            return caches.delete(name);
          }
        })
      )
    )
  );
});

// On fetch: try cache first, then network
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response; // return cached version
      }
      return fetch(event.request).then(fetchRes => {
        // Optionally cache new requests (e.g. QR codes or viewer)
        return fetchRes;
      }).catch(err => {
        console.error("[ServiceWorker] Fetch failed:", err);
        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain" }
        });
      });
    })
  );
});
