const STATIC_CACHE = "trinque-static-v2";
const STATIC_ASSETS = ["/", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest", "/offline"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/assets/") || url.pathname.endsWith(".png") || url.pathname === "/favicon.svg")) caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match("/offline"))));
});
