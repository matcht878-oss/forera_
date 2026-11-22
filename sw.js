const CACHE = "forera-v16";
const CORE = ["./", "./index.html", "./offline.html", "./manifest.webmanifest", "./favicon.ico", "./omda-logo.png", "./forera-logo.png", "./menu-1.jpg", "./menu-2.jpg",
  "./icon-192.png", "./icon-512.png", "./maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  if (/openstreetmap\.org$|googleapis\.com$|gstatic\.com$|google\.com$/.test(url.hostname) && url.hostname !== "fonts.googleapis.com" && url.hostname !== "fonts.gstatic.com") return; // map services: network only

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const r = (await e.preloadResponse) || (await fetch(req));
        const c = await caches.open(CACHE); c.put("./index.html", r.clone());
        return r;
      } catch (_) {
        return (await caches.match("./index.html")) || (await caches.match("./offline.html"));
      }
    })());
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === "opaque")) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => hit || (req.destination === "document" ? caches.match("./offline.html") : Response.error()))));
});

// Push notifications (ready for when a push server is added)
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "فوريرا", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", dir: "rtl", lang: "ar", data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(cs => {
    for (const c of cs) if ("focus" in c) return c.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./");
  }));
});
