/* Good 3 More — service worker
   目的: 通信できないときでもアプリを起動できるようにする。
   方針: いつも最新を取りに行き(ネットワーク優先)、取れないときだけ端末の控えを使う。
         記録データやSupabaseとの通信には一切さわらない。 */
const CACHE = 'g3m-shell-v1';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isShell = url.origin === self.location.origin;          // 画面一式(HTML・アイコンなど)
  const isLib = url.hostname === 'cdn.jsdelivr.net';            // 同期用ライブラリ
  if (!isShell && !isLib) return;                               // それ以外(Supabaseなど)は素通し

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: isShell });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await caches.match('./', { ignoreSearch: true }) || await caches.match('index.html', { ignoreSearch: true });
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
