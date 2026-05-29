// ShopChampion Service Worker — v3
const CACHE_NAME = "shopchampion-v3";

const APP_SHELL = [
  "/ShopChampion-Admin.html",
  "/ShopChampion-Display.html",
  "/ShopChampion-SellerPanel.html",
  "/manifest.json",
  "/config.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log("Deleting old cache:", k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const isApi =
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("jsonbin.io") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("googleapis.com");

  if (isApi) return;

  // Network first — always try to get fresh version
  event.respondWith(
    fetch(event.request, { cache: "no-cache" })
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
