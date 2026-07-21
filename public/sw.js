const STATIC_CACHE = "trinque-static-v1";
const STATIC_ASSETS = ["/", "/favicon.svg", "/manifest.webmanifest"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { if (response.ok && (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/assets/") || url.pathname === "/favicon.svg")) caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, response.clone())); return response; })));
});
