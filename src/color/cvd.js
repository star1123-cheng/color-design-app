// 色弱模擬與灰階列印檢查（SPEC 4.5 第 2、3 點）
// 色弱矩陣：Machado、Oliveira、Fernandes（2009）公開的模擬矩陣，作用在線性 RGB。
// （假設）採嚴重度 1.0（最嚴重的情況）：最嚴重時分得出來，較輕微的色弱通常也分得出來。
import { hexToRgb, rgbToHex, srgbToLinear, linearToSrgb, hexToOklch, hueDiff } from './oklch.js';

export const CVD_TYPES = ['protan', 'deutan', 'tritan'];
export const CVD_LABELS = { protan: '紅色弱', deutan: '綠色弱', tritan: '藍色弱' };

export const CVD_MATRICES = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.303900],
  ],
};

// SPEC 4.5 的門檻
export const GRAYSCALE_MIN_DIFF = 0.12; // 第 2 點：灰階 L 差
export const CVD_MIN_L_DIFF = 0.10;     // 第 3 點：模擬後 L 差
export const CVD_MIN_HUE_DIFF = 30;     // 第 3 點：模擬後色相差（度）
// （假設）彩度太低時色相不穩定（接近灰色），兩色模擬後彩度都 ≥ 這個值，色相差才算數
export const CVD_HUE_MIN_C = 0.03;

const toLinear = (hex) => hexToRgb(hex).map((v) => srgbToLinear(v / 255));
const toHex = (lin) => rgbToHex(lin.map((v) => linearToSrgb(Math.min(1, Math.max(0, v))) * 255));

/** 模擬色弱看到的顏色（輸入、輸出都是 HEX） */
export function simulateCvd(hex, type) {
  const m = CVD_MATRICES[type];
  if (!m) throw new Error(`未知的色弱類型：${type}`);
  const [r, g, b] = toLinear(hex);
  return toHex(m.map(([x, y, z]) => x * r + y * g + z * b));
}

/** 相對亮度（線性 RGB，係數同 WCAG 2.x） */
const luminance = (hex) => {
  const [r, g, b] = toLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * 轉成灰階（黑白列印的樣子）。
 * （假設）以相對亮度轉灰：亮度相同的顏色，印成黑白會是同一個灰。
 */
export const toGrayHex = (hex) => toHex(Array(3).fill(luminance(hex)));

/** 灰階後的 OKLCH L（灰色的 OKLab L 等於亮度的立方根） */
export const grayL = (hex) => Math.cbrt(luminance(hex));

/** 灰階列印檢查：兩色轉灰階後 L 差 ≥ 0.12 */
export function checkGrayscale(aHex, bHex) {
  const diff = Math.abs(grayL(aHex) - grayL(bHex));
  return { diff, ok: diff >= GRAYSCALE_MIN_DIFF };
}

/** 單一類型的色弱檢查：模擬後 L 差 ≥ 0.10，或色相差 ≥ 30° */
export function checkCvdPair(aHex, bHex, type) {
  const a = hexToOklch(simulateCvd(aHex, type));
  const b = hexToOklch(simulateCvd(bHex, type));
  const lDiff = Math.abs(a[0] - b[0]);
  const hDiff = a[1] >= CVD_HUE_MIN_C && b[1] >= CVD_HUE_MIN_C ? hueDiff(a[2], b[2]) : 0;
  return { ok: lDiff >= CVD_MIN_L_DIFF || hDiff >= CVD_MIN_HUE_DIFF, lDiff, hueDiff: hDiff };
}

/** 三種色弱檢查，回傳 SPEC 3.1 的 checks.cvd 格式 */
export function checkCvd(aHex, bHex) {
  return Object.fromEntries(CVD_TYPES.map((t) => [t, checkCvdPair(aHex, bHex, t).ok]));
}

/** 未通過的色弱類型 → 警告文字；全部通過回傳 null */
export function cvdWarning(cvd) {
  const failed = CVD_TYPES.filter((t) => cvd[t] === false).map((t) => CVD_LABELS[t]);
  return failed.length ? `${failed.join('、')}的人可能分不清主色與輔色，建議把兩色的明度拉開一些` : null;
}

export const SIM_TYPES = ['none', 'gray', ...CVD_TYPES];
export const SIM_LABELS = { none: '原本的顏色', gray: '黑白列印', ...CVD_LABELS };

/**
 * 把一組配色換成模擬後的樣子（預覽用）。
 * @param {Record<string, { hex: string }>} colors SPEC 3.1 的 colors
 * @param {'none'|'gray'|'protan'|'deutan'|'tritan'} type
 */
export function simulateColors(colors, type) {
  if (!type || type === 'none') return colors;
  const fn = type === 'gray' ? toGrayHex : (hex) => simulateCvd(hex, type);
  return Object.fromEntries(Object.entries(colors).map(([role, c]) => {
    const hex = fn(c.hex);
    return [role, { hex, oklch: hexToOklch(hex) }];
  }));
}
