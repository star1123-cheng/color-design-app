// 色域修正（SPEC 第 3 節）：保持 L 與 H，降低 C 直到落在 sRGB 內
import { oklchToLinearRgb, linearToSrgb, rgbToHex, hexToOklch } from './oklch.js';

const EPS = 1e-6;

/** 線性 RGB 是否在 sRGB 色域內 */
export const inGamut = (lin) => lin.every((v) => v >= -EPS && v <= 1 + EPS);

/** OKLCH 是否可直接以 sRGB 表示 */
export const isInGamut = (lch) => inGamut(oklchToLinearRgb(lch));

/** 回傳色域內、L 與 H 不變、C 盡量大的 OKLCH（二分搜尋） */
export function clampChroma([L, C, H]) {
  const l = Math.min(1, Math.max(0, L));
  if (l <= 0 || l >= 1) return [l, 0, H];
  if (isInGamut([l, C, H])) return [l, C, H];
  let lo = 0, hi = C;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (isInGamut([l, mid, H])) lo = mid; else hi = mid;
  }
  return [l, lo, H];
}

/** 某個 L、H 下，sRGB 能達到的最大 C */
export const maxChroma = (L, H) => clampChroma([L, 0.4, H])[1];

/** OKLCH → HEX（先做色域修正，結果一定是合法 HEX） */
export function oklchToHex(lch) {
  const lin = oklchToLinearRgb(clampChroma(lch));
  return rgbToHex(lin.map((v) => linearToSrgb(Math.min(1, Math.max(0, v))) * 255));
}

/** 經過 HEX 量化後的實際 OKLCH（推薦結果記錄的值以此為準） */
export const quantize = (lch) => {
  const hex = oklchToHex(lch);
  return { hex, oklch: hexToOklch(hex) };
};
