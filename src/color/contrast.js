// 對比度（SPEC 4.3）：WCAG 2.x 相對亮度公式
import { hexToRgb } from './oklch.js';
import { oklchToHex } from './gamut.js';

// WCAG 2.x 原文的門檻值為 0.03928
const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** 對比度門檻（SPEC 4.3） */
export const CONTRAST = { text: 4.5, largeText: 3, projectionText: 7, graphic: 3 };

/** 按鈕上的字：黑或白取對比較高者 */
export function bestTextOn(bgHex) {
  const black = contrastRatio('#000000', bgHex);
  const white = contrastRatio('#FFFFFF', bgHex);
  return black >= white ? { hex: '#000000', ratio: black } : { hex: '#FFFFFF', ratio: white };
}

/**
 * 調整 L（保持 H 與 C）直到對 against 的對比度 ≥ min。
 * 最多調整 ±maxDelta（SPEC 4.3：L ± 0.30），往「拉開明度差」的方向。
 * 回傳 { oklch, hex, ratio, ok, delta }
 */
export function adjustForContrast(lch, againstHex, min, maxDelta = 0.3) {
  const [L, C, H] = lch;
  const start = oklchToHex(lch);
  const startRatio = contrastRatio(start, againstHex);
  if (startRatio >= min) return { oklch: lch, hex: start, ratio: startRatio, ok: true, delta: 0 };

  const againstIsLight = relativeLuminance(againstHex) > relativeLuminance(start);
  const dir = againstIsLight ? -1 : 1;
  const step = 0.005;
  for (let d = step; d <= maxDelta + 1e-9; d += step) {
    const nl = Math.min(1, Math.max(0, L + dir * d));
    const hex = oklchToHex([nl, C, H]);
    const ratio = contrastRatio(hex, againstHex);
    if (ratio >= min) return { oklch: [nl, C, H], hex, ratio, ok: true, delta: dir * d };
  }
  const nl = Math.min(1, Math.max(0, L + dir * maxDelta));
  const hex = oklchToHex([nl, C, H]);
  return { oklch: [nl, C, H], hex, ratio: contrastRatio(hex, againstHex), ok: false, delta: dir * maxDelta };
}
