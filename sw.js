// ShopChampion Service Worker — v1
// Caches the app shell for offline use. Data (Supabase/Firebase) always fetched live.

const CACHE_NAME = "shopchampion-v1";
const APP_SHELL = [
  "/ShopChampion-Admin.html",
  "/ShopChampion-Display.html",
  "/ShopChampion-SellerPanel.html",
  "/manifest.json"
];

// ── Install: cache the app shell ──
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ──
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Network first, fallback to cache ──
// External APIs (Supabase, Firebase, JSONbin) always go to network directly.
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Always pass API calls straight through — never cache these
  const isApiCall =
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("jsonbin.io") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("googleapis.com");

  if (isApiCall) {
    return; // Let browser handle normally
  }

  // For app shell files: network first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Update cache with fresh copy if successful
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // If navigating to any page, serve Admin as fallback
          if (event.request.mode === "navigate") {
            return caches.match("/ShopChampion-Admin.html");
          }
        });
      })
  );
});
