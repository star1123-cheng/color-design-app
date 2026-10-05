// sRGB 與 OKLCH 互轉（SPEC 第 3 節）
// OKLCH 一律以陣列 [L, C, H] 表示：L 0–1、C ≥ 0、H 0–360°
// 矩陣來源：Björn Ottosson 公開的 OKLab 定義

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** 檢查是否為合法 HEX（接受 #RGB 與 #RRGGBB） */
export const isHex = (hex) => typeof hex === 'string' && HEX_RE.test(hex.trim());

/** HEX → [r, g, b]（0–255） */
export function hexToRgb(hex) {
  const m = HEX_RE.exec(String(hex).trim());
  if (!m) throw new Error(`不是合法的 HEX 色碼：${hex}`);
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** [r, g, b]（0–255）→ 大寫 6 碼 HEX */
export function rgbToHex(rgb) {
  return '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** 統一成大寫 6 碼 HEX */
export const normalizeHex = (hex) => rgbToHex(hexToRgb(hex));

// sRGB gamma 解碼／編碼（0–1）
export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** 線性 RGB（0–1）→ OKLab [L, a, b] */
export function linearRgbToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab [L, a, b] → 線性 RGB（可能超出 0–1，代表超出 sRGB 色域） */
export function oklabToLinearRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklabToOklch([L, a, b]) {
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, Math.hypot(a, b), H];
}

export function oklchToOklab([L, C, H]) {
  const rad = (H * Math.PI) / 180;
  return [L, C * Math.cos(rad), C * Math.sin(rad)];
}

/** HEX → OKLCH [L, C, H] */
export function hexToOklch(hex) {
  const lin = hexToRgb(hex).map((v) => srgbToLinear(v / 255));
  return oklabToOklch(linearRgbToOklab(lin));
}

/** OKLCH → 線性 RGB（不做色域修正） */
export const oklchToLinearRgb = (lch) => oklabToLinearRgb(oklchToOklab(lch));

/** 依 SPEC 3.1：L、C 取 3 位小數，H 取 1 位 */
export function roundOklch([L, C, H]) {
  const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  return [r(L, 3), r(C, 3), r(H, 1) % 360];
}

/** 兩個色相的最小夾角（0–180°） */
export function hueDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 色相正規化到 0–360° */
export const normalizeHue = (h) => ((h % 360) + 360) % 360;

// ---------- 輸出格式（SPEC 第 3 節：HEX、oklch()、HSL、RGB） ----------

export function toOklchString(lch) {
  const [L, C, H] = roundOklch(lch);
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
}

export function toRgbString(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

export function toHslString(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}
