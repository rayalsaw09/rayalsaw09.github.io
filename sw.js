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

// ── FCM background push messages ─────────────────────────────────────────────
// Firebase Messaging SDK injected by importScripts when FCM is active
try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey:            "AIzaSyAdNjL9gCptnAbJ6ZVm9BZ61rKfBtwc1Qc",
    authDomain:        "shop-champion.firebaseapp.com",
    projectId:         "shop-champion",
    storageBucket:     "shop-champion.firebasestorage.app",
    messagingSenderId: "81324128909",
    appId:             "1:81324128909:web:cc023f5c031c505bfe00c4"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    const { title = "ShopChampion", body = "" } = payload.notification || {};
    return self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-96.png",
      tag: "sc-notification",
      renotify: true,
      data: { url: "/ShopChampion-Admin.html#tab8" }
    });
  });

  self.addEventListener("notificationclick", event => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || "/ShopChampion-Admin.html";
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
        for (const client of list) {
          if (client.url.includes("ShopChampion-Admin") && "focus" in client) return client.focus();
        }
        return clients.openWindow(target);
      })
    );
  });
} catch(e) { /* FCM scripts unavailable (file:// or offline) — skip */ }
