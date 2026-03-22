const CACHE_NAME = "nutrify-v1";

const ASSETS = [
  "/nutrify/",
  "/nutrify/index.html",
  "/nutrify/style.css",
  "/nutrify/app.js",
  "/nutrify/foods.json",
  "/nutrify/favicon.svg",
  "/nutrify/manifest.json",
  "/nutrify/icons/icon-192.png",
  "/nutrify/icons/icon-512.png",
];

// Install — cache all assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
  self.skipWaiting();
});

// Activate — delete old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// Fetch — serve from cache, fall back to network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached || fetch(event.request)),
  );
});
