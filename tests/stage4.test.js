// 階段 4：匯出格式、收藏（localStorage 錯誤處理）、PWA（manifest、圖示、Service Worker 快取清單）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hexList, rgbList, cssVariables, cssOklch, slidesTheme } from '../src/export/formats.js';
import { loadFavorites, addFavorite, removeFavorite, renameFavorite, STORAGE_KEY, MAX_FAVORITES } from '../src/data/favorites.js';
import { recommend } from '../src/color/palette.js';
import { contrastRatio } from '../src/color/contrast.js';
import { resolveRequest } from '../scripts/serve.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [p] = recommend('#78A5CE', { mode: 'teacher' });
const ROLES = ['primary', 'secondary', 'background', 'text', 'accent'];

// ---------- 匯出 ----------

test('HEX 清單、RGB 清單：五行、大寫 HEX', () => {
  const lines = hexList(p).split('\n');
  assert.equal(lines.length, 5);
  lines.forEach((l, i) => assert.ok(l.endsWith(p.colors[ROLES[i]].hex)));
  assert.match(rgbList(p).split('\n')[0], /rgb\(\d+, \d+, \d+\)$/);
});

test('CSS 變數與 oklch() 版本：:root 內五個 --color-* 變數', () => {
  const css = cssVariables(p);
  assert.match(css, /^:root \{\n/);
  for (const r of ROLES) assert.ok(css.includes(`  --color-${r}: ${p.colors[r].hex};`), r);
  const ok = cssOklch(p);
  for (const r of ROLES) assert.match(ok, new RegExp(`--color-${r}: oklch\\([\\d.]+% [\\d.]+ [\\d.]+\\);`));
});

test('Google 簡報主題色：12 個欄位、合法 HEX；超連結與深色 2 對背景 ≥ 4.5:1', () => {
  const t = slidesTheme(p);
  assert.equal(t.length, 12);
  for (const x of t) assert.match(x.hex, /^#[0-9A-F]{6}$/);
  const by = Object.fromEntries(t.map((x) => [x.field, x.hex]));
  assert.equal(by['深色 1（文字）'], p.colors.text.hex);
  assert.equal(by['淺色 1（背景）'], p.colors.background.hex);
  for (const f of ['超連結', '深色 2', '已點連結']) assert.ok(contrastRatio(by[f], p.colors.background.hex) >= 4.5, f);
});

// ---------- 收藏 ----------

/** 假的 localStorage；可設定讀寫時丟錯 */
function fakeStorage({ throwGet = false, throwSet = false, init = {} } = {}) {
  const data = { ...init };
  return {
    data,
    getItem: (k) => { if (throwGet) throw new Error('blocked'); return k in data ? data[k] : null; },
    setItem: (k, v) => { if (throwSet) throw new Error('QuotaExceededError'); data[k] = String(v); },
  };
}

test('收藏：空資料回傳空陣列、沒有錯誤', () => {
  assert.deepEqual(loadFavorites(fakeStorage()), { palettes: [], skipped: 0, error: null });
  assert.deepEqual(loadFavorites(fakeStorage({ init: { [STORAGE_KEY]: '' } })).palettes, []);
});

test('收藏：資料損毀（不是 JSON、不是陣列）不當機，回報錯誤', () => {
  for (const bad of ['{壞掉', '{"a":1}', 'null', '42']) {
    const r = loadFavorites(fakeStorage({ init: { [STORAGE_KEY]: bad } }));
    assert.deepEqual(r.palettes, [], bad);
    assert.ok(r.error, bad);
  }
});

test('收藏：不認得的 schemaVersion 與格式錯誤的單筆會被跳過，其他照常讀取', () => {
  const good = { ...p, id: 'a' };
  const raw = JSON.stringify([good, { ...p, schemaVersion: 99 }, { foo: 1 }, 'x']);
  const r = loadFavorites(fakeStorage({ init: { [STORAGE_KEY]: raw } }));
  assert.equal(r.palettes.length, 1);
  assert.equal(r.skipped, 3);
  assert.match(r.error, /3 筆/);
});

test('收藏：localStorage 無法使用或丟錯（無痕模式、空間不足）不當機', () => {
  assert.ok(loadFavorites(null).error);
  assert.ok(loadFavorites(fakeStorage({ throwGet: true })).error);
  const r = addFavorite(p, fakeStorage({ throwSet: true }));
  assert.equal(r.ok, false);
  assert.match(r.message, /無法儲存/);
  assert.equal(addFavorite(p, null).ok, false);
});

test('收藏：加入、重複不再加入、改名、刪除；資料可序列化還原', () => {
  const s = fakeStorage();
  const a = addFavorite(p, s);
  assert.ok(a.ok);
  assert.equal(addFavorite(p, s).ok, false, '同一組五色不重複收藏');
  const id = a.palettes[0].id;
  assert.notEqual(id, p.id, '收藏另給新 id');
  assert.equal(renameFavorite(id, '  五年一班簡報  ', s).palettes[0].name, '五年一班簡報');
  assert.equal(renameFavorite(id, '   ', s).ok, false);
  assert.equal(renameFavorite(id, 'x'.repeat(50), s).palettes[0].name.length, 30);
  assert.deepEqual(loadFavorites(s).palettes, JSON.parse(s.data[STORAGE_KEY]));
  assert.equal(removeFavorite(id, s).palettes.length, 0);
});

test(`收藏：上限 ${MAX_FAVORITES} 組（假設）`, () => {
  const s = fakeStorage();
  const list = recommend('#78A5CE', { seed: 1 });
  let n = 0;
  for (let i = 0; n < MAX_FAVORITES; i++) {
    const q = structuredClone(list[0]);
    q.colors.accent.hex = `#${(0x100000 + i).toString(16).toUpperCase()}`;
    if (addFavorite(q, s).ok) n++;
  }
  const q = structuredClone(list[1]);
  assert.match(addFavorite(q, s).message, /最多/);
});

// ---------- PWA ----------

const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));

test('manifest：名稱、相對路徑 start_url、standalone、192 與 512 圖示（含 maskable）', () => {
  assert.equal(manifest.short_name, '色境');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'standalone');
  for (const size of ['192x192', '512x512']) {
    for (const purpose of ['any', 'maskable']) {
      assert.ok(manifest.icons.some((i) => i.sizes === size && i.purpose === purpose), `${size} ${purpose}`);
    }
  }
});

test('圖示檔存在，且 PNG 尺寸與 manifest 一致', () => {
  for (const icon of manifest.icons) {
    const buf = readFileSync(path.join(ROOT, icon.src));
    assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', icon.src);
    const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    assert.equal(`${w}x${h}`, icon.sizes, icon.src);
  }
});

const sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const precache = [...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);

function walk(rel) {
  return readdirSync(path.join(ROOT, rel)).flatMap((n) => {
    const r = `${rel}/${n}`;
    return statSync(path.join(ROOT, r)).isDirectory() ? walk(r) : [r];
  });
}

test('Service Worker：快取清單涵蓋所有網頁檔，且每個檔案都存在', () => {
  const needed = ['index.html', 'manifest.webmanifest', ...walk('src'), ...walk('icons')];
  for (const f of needed) assert.ok(precache.includes(f), `sw.js 的 PRECACHE 缺少 ${f}`);
  for (const f of precache.filter((x) => x !== './')) assert.ok(existsSync(path.join(ROOT, f)), `${f} 不存在`);
});

test('index.html 的 modulepreload 清單涵蓋 main.js 靜態引用的所有檔案（載入速度）', () => {
  const seen = new Set();
  const visit = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    const src = readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+'([^']+)'|^import\s+'([^']+)'/gm)) {
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1] ?? m[2])));
    }
  };
  visit('src/main.js');
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const preload = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual([...preload].sort(), [...seen].filter((f) => f !== 'src/main.js').sort());
});

test('Service Worker：抓檔與安裝都略過瀏覽器的舊快取（避免 GitHub Pages max-age 讓 F5 看不到更新）', () => {
  assert.match(sw, /new Request\(req, \{ cache: 'no-cache' \}\)/);
  assert.match(sw, /c\.addAll\(PRECACHE\.map\(\(u\) => new Request\(u, \{ cache: 'reload' \}\)\)\)/);
});

test('Service Worker：只處理同網域 GET，不快取外部請求；網址都是相對路徑', () => {
  assert.match(sw, /req\.method !== 'GET' \|\| new URL\(req\.url\)\.origin !== self\.location\.origin\) return/);
  assert.doesNotMatch(sw, /https?:\/\//);
  assert.ok(precache.every((f) => !f.startsWith('/')), 'GitHub Pages 子路徑需要相對路徑');
});

test('預覽伺服器：提供 manifest、sw.js、icons/', () => {
  assert.equal(resolveRequest('/manifest.webmanifest'), 'manifest.webmanifest');
  assert.equal(resolveRequest('/sw.js'), 'sw.js');
  assert.equal(resolveRequest('/icons/icon-192.png'), 'icons/icon-192.png');
  assert.equal(resolveRequest('/icons/../package.json'), null);
});
