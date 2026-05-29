// ShopChampion Service Worker — v2
// Updated cache version forces fresh fetch of all files

const CACHE_NAME = "shopchampion-v2";
const APP_SHELL = [
  "/ShopChampion-Admin.html",
  "/ShopChampion-Display.html",
  "/ShopChampion-SellerPanel.html",
  "/manifest.json",
  "/config.js"
];

// ── Install: cache the app shell ──
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting(); // activate immediately
});

// ── Activate: remove ALL old caches ──
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: Network first, fallback to cache ──
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Always bypass cache for API calls
  const isApi =
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("jsonbin.io") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("anthropic.com");

  if (isApi) return; // let browser handle directly

  // Network first for app files
  event.respondWith(
    fetch(event.request)
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
