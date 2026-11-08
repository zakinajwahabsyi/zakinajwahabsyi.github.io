/* Jalan Muntazhir: bisa dibuka tanpa internet setelah kunjungan pertama */
const V = "muntazhir-v1";
const FONTS = V + "-fonts";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== V && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (r.mode === "navigate") {
      e.respondWith(fetch(r).then(res => {
        const copy = res.clone(); caches.open(V).then(c => c.put("index.html", copy)); return res;
      }).catch(() => caches.match("index.html")));
      return;
    }
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => {
      const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)); return res;
    })));
    return;
  }
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(c => c.match(r).then(m => m || fetch(r).then(res => {
      c.put(r, res.clone()); return res;
    }))));
  }
});
