// 圖片取色（SPEC 4.6 第 2 點）：自行實作 k-means（在 OKLab 空間分群），輸出 5 個代表色。
// 本檔只處理像素陣列，不碰檔案與網路；讀圖、縮圖由 src/ui/image-pick.js 在瀏覽器本機完成。
import { srgbToLinear, linearRgbToOklab, oklabToOklch, hexToOklch } from './oklch.js';
import { oklchToHex } from './gamut.js';
import { createRng } from './harmony.js';

/** 縮圖尺寸：長邊不超過 max，保持比例，至少 1 px */
export function fitSize(width, height, max = 160) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** 取樣：略過半透明像素，最多 maxSamples 個（等間隔取樣，結果可重現） */
function samplePixels(data, maxSamples, minAlpha) {
  const total = Math.floor(data.length / 4);
  const step = Math.max(1, Math.ceil(total / maxSamples));
  const out = [];
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if (data[o + 3] < minAlpha) continue;
    out.push(linearRgbToOklab([data[o], data[o + 1], data[o + 2]].map((v) => srgbToLinear(v / 255))));
  }
  return out;
}

/** k-means++ 起始中心（固定種子） */
function initCenters(points, k, rng) {
  const centers = [points[Math.floor(rng() * points.length)]];
  const d = points.map((p) => dist2(p, centers[0]));
  while (centers.length < k) {
    const sum = d.reduce((a, v) => a + v, 0);
    if (sum === 0) break; // 剩下的點都和現有中心重疊：顏色種類不足 k 個
    let r = rng() * sum, idx = 0;
    while (idx < d.length - 1 && (r -= d[idx]) > 0) idx++;
    centers.push(points[idx]);
    points.forEach((p, i) => { d[i] = Math.min(d[i], dist2(p, points[idx])); });
  }
  return centers.map((c) => [...c]);
}

/**
 * 從 RGBA 像素取出代表色。
 * @param {Uint8ClampedArray|number[]} data Canvas getImageData().data（RGBA 連續排列）
 * @param {{ k?: number, maxSamples?: number, minAlpha?: number, iterations?: number, seed?: number }} [opts]
 * @returns {{ hex: string, oklch: number[], share: number }[]} 依佔比由多到少排序；顏色種類不足時少於 k 個
 */
export function extractColors(data, { k = 5, maxSamples = 6000, minAlpha = 128, iterations = 20, seed = 1 } = {}) {
  const points = samplePixels(data, maxSamples, minAlpha);
  if (!points.length) return [];
  const centers = initCenters(points, k, createRng(seed));
  const assign = new Array(points.length).fill(-1);

  for (let it = 0; it < iterations; it++) {
    let changed = false;
    points.forEach((p, i) => {
      let best = 0, bestD = Infinity;
      centers.forEach((c, j) => { const dd = dist2(p, c); if (dd < bestD) { bestD = dd; best = j; } });
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    });
    if (!changed) break;
    const sums = centers.map(() => [0, 0, 0, 0]);
    points.forEach((p, i) => { const s = sums[assign[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    sums.forEach((s, j) => { if (s[3]) centers[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }

  const counts = centers.map(() => 0);
  assign.forEach((j) => { counts[j]++; });
  return centers
    .map((c, j) => {
      const hex = oklchToHex(oklabToOklch(c)); // 平均值可能稍微超出 sRGB，oklchToHex 會做色域修正
      return { hex, oklch: hexToOklch(hex), share: counts[j] / points.length };
    })
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}
