// Service Worker for PWA functionality
const CACHE_NAME = "nutritrack-v1"
const urlsToCache = ["/", "/dashboard", "/auth/login", "/manifest.json", "/icon-192.png", "/icon-512.png"]

self.addEventListener("install", (event: any) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)))
})

self.addEventListener("fetch", (event: any) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request)
    }),
  )
})
