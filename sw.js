// ShopChampion Service Worker — v6
const CACHE_NAME = "shopchampion-v6";

const APP_SHELL = [
  "/ShopChampion-Admin.html",
  "/ShopChampion-Display.html",
  "/ShopChampion-SellerPanel.html",
  "/manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(()=>{}))
  );
  self.skipWaiting(); // activate immediately
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log("Deleting old cache:", k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
  // Notify all clients to reload after SW update
  self.clients.matchAll({ type: "window" }).then(clients => {
    clients.forEach(client => client.postMessage({ type: "SW_UPDATED" }));
  });
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const isExternal =
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("jsonbin.io") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("google.com");

  if (isExternal) return; // let Firebase/Supabase calls go through unmodified

  // Network first — always try fresh, fallback to cache
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
