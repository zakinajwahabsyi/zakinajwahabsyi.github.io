/* Maqtal Reader – service worker
 * - Menyimpan aplikasi (HTML, pdf.js, huruf, ikon) agar bisa dibuka tanpa internet.
 * - Naskah PDF dan musik/efek disimpan di cache 'maqtal-media-v1' saat pertama dipakai
 *   (atau sekaligus lewat menu Aa > "Tanpa internet").
 * - Permintaan sebagian (Range) dilayani dari cache, karena pemutar musik iPhone (Safari)
 *   membutuhkan ini untuk memutar dan menggeser posisi musik.
 * Naikkan VERSION setiap kali file aplikasi diganti.
 */
const VERSION = 'v2';
const SHELL = 'maqtal-shell-' + VERSION;
const MEDIA = 'maqtal-media-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon-v2.png',
  './icon-192-v2.png',
  './icon-512-v2.png',
  './lib/pdf.min.mjs',
  './lib/pdf.worker.min.mjs',
  './fonts/Literata.ttf',
  './fonts/Literata-Italic.ttf',
  './fonts/InstrumentSans.ttf',
  './fonts/Amiri-Regular.ttf',
  './fonts/Amiri-Bold.ttf',
];
const MEDIA_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm|pdf)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // satu per satu agar satu file gagal tidak menggagalkan semuanya
    await Promise.all(SHELL_FILES.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('maqtal-shell-') && k !== SHELL) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (MEDIA_RE.test(url.pathname)) { event.respondWith(media(req)); return; }
  if (req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname)) { event.respondWith(networkFirst(req)); return; }
  event.respondWith(cacheFirst(req));
});

function cleanUrl(u) { const x = new URL(u); x.hash = ''; x.search = ''; return x.href; }

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const net = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ]);
    if (net && net.ok) cache.put('./index.html', net.clone()).catch(() => {});
    return net;
  } catch (e) {
    const hit = (await cache.match('./index.html')) || (await cache.match('./'));
    return hit || new Response('Tidak ada koneksi internet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const net = await fetch(req);
    if (net && net.ok && net.status === 200) {
      const cache = await caches.open(SHELL);
      cache.put(req, net.clone()).catch(() => {});
    }
    return net;
  } catch (e) {
    return new Response('', { status: 504 });
  }
}

async function media(req) {
  const key = cleanUrl(req.url);
  const cache = await caches.open(MEDIA);
  let full = await cache.match(key);
  if (!full) {
    let net;
    try {
      net = await fetch(key, { cache: 'no-store' });   // file utuh (tanpa Range) agar bisa disimpan
    } catch (e) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
    if (!net.ok || net.status !== 200) return net;
    try { await cache.put(key, net.clone()); } catch (e) { /* penyimpanan penuh: tetap putar */ }
    full = net;
  }
  const range = req.headers.get('range');
  return range ? sliceRange(full, range) : full;
}

async function sliceRange(res, range) {
  const blob = await res.blob();
  const len = blob.size;
  const type = res.headers.get('Content-Type') || 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/i.exec(range || '');
  if (!m || (m[1] === '' && m[2] === '')) {
    return new Response(blob, { status: 200, headers: { 'Content-Type': type, 'Content-Length': String(len), 'Accept-Ranges': 'bytes' } });
  }
  let start, end;
  if (m[1] === '') { start = Math.max(0, len - Number(m[2])); end = len - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? len - 1 : Math.min(Number(m[2]), len - 1); }
  if (start >= len || start > end) {
    return new Response(null, { status: 416, statusText: 'Range Not Satisfiable', headers: { 'Content-Range': 'bytes */' + len } });
  }
  return new Response(blob.slice(start, end + 1, type), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${len}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
