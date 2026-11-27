/* Mi Tablero · service worker
   - Guarda la app en el teléfono para abrirla sin internet.
   - index.html: primero la red (así llegan los cambios solos), si no hay señal usa la copia.
   - Recibe las notificaciones (Firebase Cloud Messaging). */
const V = "tablero-v5";
const SHELL = ["./", "index.html", "manifest.webmanifest", "firebase-config.js",
  "vendor/firebase-app-compat.js", "vendor/firebase-auth-compat.js",
  "vendor/firebase-firestore-compat.js", "vendor/firebase-messaging-compat.js",
  "icons/icon-192.png", "icons/badge-96.png", "icons/favicon-32.png", "icons/apple-touch-icon.png"];
const FONTS = "tablero-fonts";

importScripts("firebase-config.js", "vendor/firebase-app-compat.js", "vendor/firebase-messaging-compat.js");

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms)); }

async function networkFirst(req) {
  const c = await caches.open(V);
  try {
    const res = await Promise.race([fetch(req, { cache: "no-cache" }), timeout(4000)]);
    if (res && res.ok) c.put("index.html", res.clone());
    return res;
  } catch (e) {
    return (await c.match("index.html")) || (await c.match("./")) || Response.error();
  }
}
async function staleWhileRevalidate(req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req, { ignoreSearch: cacheName === V });
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
      e.respondWith(networkFirst(req));
    } else {
      e.respondWith(staleWhileRevalidate(req, V));
    }
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate(req, FONTS));
  }
  // Lo demás (Firebase, Google) va directo a la red; Firestore guarda su propia copia offline.
});

/* ---------- notificaciones ---------- */
function show(d) {
  d = d || {};
  return self.registration.showNotification(d.title || "Mi Tablero", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag,
    icon: "icons/icon-192.png", badge: "icons/badge-96.png", data: { url: d.url || "./" }
  });
}
if (self.FB_CONFIG && self.FB_CONFIG.apiKey && self.firebase) {
  firebase.initializeApp(self.FB_CONFIG);
  firebase.messaging().onBackgroundMessage(p => show(p.data));
}
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const w of list) { if (w.url.startsWith(self.registration.scope)) { w.focus(); if (w.url !== target) w.navigate(target).catch(() => {}); return; } }
    return self.clients.openWindow(target);
  }));
});
