// 階段 3：圖片取色演算法（SPEC 4.6 第 2 點）。以合成的像素陣列測試，不讀任何圖片檔。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractColors, fitSize } from '../src/color/extract.js';
import { hexToRgb } from '../src/color/oklch.js';

/** 依 [hex, 像素數] 產生 RGBA 陣列（依序排列，就像一張分成色塊的圖） */
function pixels(blocks, alpha = 255) {
  const out = [];
  for (const [hex, n] of blocks) {
    const [r, g, b] = hexToRgb(hex);
    for (let i = 0; i < n; i++) out.push(r, g, b, alpha);
  }
  return new Uint8ClampedArray(out);
}

const BLOCKS = [['#78A5CE', 400], ['#F5F1EA', 300], ['#342C25', 150], ['#E36F4F', 100], ['#6B9274', 50]];

test('5 個色塊：找回 5 個原色，依面積由多到少排序', () => {
  const out = extractColors(pixels(BLOCKS));
  assert.equal(out.length, 5);
  assert.deepEqual(out.map((c) => c.hex), BLOCKS.map(([h]) => h));
  const total = BLOCKS.reduce((a, [, n]) => a + n, 0);
  out.forEach((c, i) => assert.ok(Math.abs(c.share - BLOCKS[i][1] / total) < 1e-9));
  assert.ok(Math.abs(out.reduce((a, c) => a + c.share, 0) - 1) < 1e-9);
});

test('有雜訊（每個像素 ±6）時，代表色仍接近原色', () => {
  let seed = 1;
  const noise = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed % 13) - 6; };
  const data = pixels(BLOCKS).map((v, i) => ((i % 4) === 3 ? v : Math.min(255, Math.max(0, v + noise()))));
  const out = extractColors(data);
  assert.equal(out.length, 5);
  for (const [hex] of BLOCKS) {
    const want = hexToRgb(hex);
    const near = out.some((c) => hexToRgb(c.hex).every((v, k) => Math.abs(v - want[k]) <= 4));
    assert.ok(near, `找不到接近 ${hex} 的代表色：${out.map((c) => c.hex).join(' ')}`);
  }
});

test('固定種子可重現；結果都是大寫 6 碼 HEX', () => {
  // 漸層圖：顏色連續變化，沒有明確的 5 個答案
  const data = [];
  for (let i = 0; i < 2000; i++) data.push(Math.round((i / 2000) * 255), 120, 255 - Math.round((i / 2000) * 255), 255);
  const a = extractColors(data), b = extractColors(data);
  assert.deepEqual(a, b);
  assert.equal(a.length, 5);
  for (const c of a) assert.match(c.hex, /^#[0-9A-F]{6}$/);
  assert.equal(new Set(a.map((c) => c.hex)).size, 5, '5 個代表色不重複');
});

test('略過透明像素', () => {
  const data = new Uint8ClampedArray([...pixels([['#78A5CE', 50]]), ...pixels([['#E36F4F', 500]], 0)]);
  const out = extractColors(data);
  assert.deepEqual(out.map((c) => c.hex), ['#78A5CE']);
});

test('顏色種類不足 5 種時回傳實際的種類數；空圖回傳空陣列', () => {
  assert.deepEqual(extractColors(pixels([['#6B9274', 300]])).map((c) => c.hex), ['#6B9274']);
  assert.equal(extractColors(pixels([['#6B9274', 100], ['#F5F1EA', 100]])).length, 2);
  assert.deepEqual(extractColors(new Uint8ClampedArray(0)), []);
  assert.deepEqual(extractColors(pixels([['#000000', 10]], 0)), []);
});

test('大圖會取樣（maxSamples），結果仍正確', () => {
  const big = BLOCKS.map(([h, n]) => [h, n * 100]); // 10 萬像素
  const out = extractColors(pixels(big), { maxSamples: 3000 });
  assert.deepEqual(out.map((c) => c.hex), BLOCKS.map(([h]) => h));
});

test('fitSize：長邊縮到上限、保持比例、小圖不放大', () => {
  assert.deepEqual(fitSize(4000, 3000, 160), { width: 160, height: 120 });
  assert.deepEqual(fitSize(1080, 1920, 160), { width: 90, height: 160 });
  assert.deepEqual(fitSize(100, 50, 160), { width: 100, height: 50 });
  assert.deepEqual(fitSize(5000, 1, 160), { width: 160, height: 1 });
});

test('取色程式不連網、不上傳：src/color/extract.js 與 src/ui/image-pick.js 沒有網路 API', () => {
  for (const f of ['../src/color/extract.js', '../src/ui/image-pick.js']) {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(t, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|https?:\/\//, f);
  }
});
