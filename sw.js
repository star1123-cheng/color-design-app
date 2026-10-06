// Service Worker（SPEC 2-4、階段 4）：只快取本網站自己的靜態檔，不快取、不轉送任何外部請求。
// 新增或刪除網站檔案時，請更新 PRECACHE 並把 CACHE 的版本號加 1，舊快取會在 activate 時刪除。
// PRECACHE 清單必須涵蓋 src/ 的所有檔案（tests/pwa.test.js 會檢查）。
const CACHE = 'color-design-app-v9';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'src/main.js',
  'src/state.js',
  'src/color/oklch.js',
  'src/color/gamut.js',
  'src/color/contrast.js',
  'src/color/gradient.js',
  'src/color/harmony.js',
  'src/color/rules.js',
  'src/color/palette.js',
  'src/color/cvd.js',
  'src/color/extract.js',
  'src/data/schema.js',
  'src/data/parts.js',
  'src/data/presets.js',
  'src/data/templates.js',
  'src/data/web-palettes.js',
  'src/data/template-palette.js',
  'src/data/favorites.js',
  'src/export/card.js',
  'src/export/formats.js',
  'src/export/ai-prompt.js',
  'src/ui/styles.css',
  'src/ui/dom.js',
  'src/ui/copy.js',
  'src/ui/custom.js',
  'src/ui/picker.js',
  'src/ui/cards.js',
  'src/ui/preview.js',
  'src/ui/gradient.js',
  'src/ui/roles.js',
  'src/ui/teacher.js',
  'src/ui/web-palettes.js',
  'src/ui/public.js',
  'src/ui/image-pick.js',
  'src/ui/export.js',
  'src/ui/favorites.js',
  'src/ui/audit-dom.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 網路優先、離線時改用快取（更新網站後馬上生效，沒網路也能開）。
// 只處理同網域的 GET，其他請求（例如 blob:、外部網址）完全不攔截。
// cache: 'no-cache'：每次都先向伺服器確認有沒有新版（沒變時伺服器只回 304，很快）。
// 否則 GitHub Pages 的 max-age=600 會讓瀏覽器 10 分鐘內一直拿舊檔，按 F5 也看不到更新（2026-10-06 修正）。
// 網頁本身（navigate）瀏覽器重新整理時本來就會確認，維持原樣。
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const fresh = req.mode === 'navigate' ? req : new Request(req, { cache: 'no-cache' });
  event.respondWith(fetch(fresh).then((res) => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  }).catch(async () => (await caches.match(req, { ignoreSearch: true }))
    ?? (req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
