/* Menuju Khadim: bisa dibuka tanpa internet setelah kunjungan pertama */
const V = "khadim-v1";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "fonts/amiri-arabic-400-normal.woff2",
  "fonts/amiri-arabic-700-normal.woff2",
  "fonts/amiri-latin-400-normal.woff2",
  "fonts/inter-latin-400-normal.woff2",
  "fonts/inter-latin-ext-400-normal.woff2",
  "fonts/inter-latin-500-normal.woff2",
  "fonts/inter-latin-ext-500-normal.woff2",
  "fonts/inter-latin-600-normal.woff2",
  "fonts/inter-latin-ext-600-normal.woff2",
  "fonts/inter-latin-700-normal.woff2",
  "fonts/inter-latin-ext-700-normal.woff2",
  "fonts/marcellus-latin-400-normal.woff2",
  "fonts/marcellus-latin-ext-400-normal.woff2"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith("khadim-") && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || !u.pathname.startsWith(new URL("./", self.registration.scope).pathname)) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(res => {
      const copy = res.clone(); caches.open(V).then(c => c.put("index.html", copy)); return res;
    }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)); }
    return res;
  })));
});
