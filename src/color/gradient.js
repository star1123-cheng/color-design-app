// 5 階漸層（SPEC 4.4）
// 全幅型（預設）：淺端 L ≥ 0.92、深端 0.20–0.60、中段彩度最高
// 淺色型：淺端 L ≥ 0.96、深端 0.80–0.88、最深階彩度最高
import { quantize } from './gamut.js';
import { contrastRatio } from './contrast.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * @param {number[]} base 基準色 OKLCH（取其色相與彩度）
 * @param {{ type?: 'full'|'light', steps?: number }} [opts]
 * @returns {{ hex: string, oklch: number[] }[]} 由淺到深
 */
export function makeGradient(base, { type = 'full', steps = 5 } = {}) {
  const [, C, H] = base;
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    let L, c;
    if (type === 'light') {
      L = 0.97 - 0.12 * t;                         // 0.97 → 0.85
      c = 0.012 + (clamp(C, 0.04, 0.08) - 0.012) * t; // 越深越鮮豔
    } else {
      L = 0.95 - 0.55 * t;                          // 0.95 → 0.40
      const peak = clamp(C, 0.06, 0.14);
      c = peak * (0.3 + 0.7 * Math.sin(Math.PI * t)); // 中段最高
    }
    out.push(quantize([L, c, H]));
  }
  return out;
}

// ---------- 漸層搭配建議（2026-10-06 使用者新增） ----------
// 用目前配色的五個角色組出幾種常見漸層。中間色在 OKLCH 計算（沿最短的色相方向），
// 避免一般 RGB 混色時中段變灰、變髒。

const ANGLE = 135; // 左上到右下，最常見的漸層方向

/** 兩色在 OKLCH 的中間色；其中一色幾乎沒有彩度時，色相跟著另一色 */
export function mixOklch(a, b, t = 0.5) {
  const [La, Ca, Ha] = a;
  const [Lb, Cb, Hb] = b;
  let h1 = Ha;
  let h2 = Hb;
  if (Ca < 0.02) h1 = Hb;
  if (Cb < 0.02) h2 = Ha;
  let d = h2 - h1;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return quantize([La + (Lb - La) * t, Ca + (Cb - Ca) * t, (((h1 + d * t) % 360) + 360) % 360]);
}

const twoTone = (a, b) => [quantize(a), mixOklch(a, b), quantize(b)];

/** 產生 CSS 語法，例如 linear-gradient(135deg, #AAAAAA 0%, #BBBBBB 100%) */
export function gradientCss(stops, angle = ANGLE) {
  const last = stops.length - 1;
  const parts = stops.map((s, i) => `${s.hex} ${last ? Math.round((i / last) * 100) : 0}%`);
  return `linear-gradient(${angle}deg, ${parts.join(', ')})`;
}

/**
 * 放在漸層上的字色：依序試字色、底色，每一段都達到 min 才算可用。
 * @returns {{ hex: string|null, ratio: number }} 都不行時 hex 為 null（表示要加底塊再放字）
 */
export function textOnGradient(stops, candidates, min) {
  let best = { hex: null, ratio: 0 };
  for (const hex of candidates) {
    const ratio = Math.min(...stops.map((s) => contrastRatio(hex, s.hex)));
    if (ratio >= min) return { hex, ratio };
    if (ratio > best.ratio) best = { hex: null, ratio };
  }
  return best;
}

/**
 * 漸層搭配建議。
 * @param {Record<string, {hex: string, oklch: number[]}>} colors 配色的五個角色
 * @param {{ min?: number }} [opts] min：放字需要的對比度
 * @returns {{ key: string, name: string, desc: string, stops: {hex: string, oklch: number[]}[], css: string, text: {hex: string|null, ratio: number} }[]}
 */
export function gradientSuggestions(colors, { min = 4.5 } = {}) {
  const { primary, secondary, accent, background, text } = colors;
  const [, Cp, Hp] = primary.oklch;
  const [, Cs, Hs] = secondary.oklch;
  const list = [
    { key: 'soft', name: '柔和同色', desc: '主色的淡淡深淺，適合整頁背景', stops: makeGradient(primary.oklch, { type: 'light' }).filter((_, i) => i % 2 === 0) },
    { key: 'main', name: '主輔漸層', desc: '主色到輔色，適合封面、標題橫幅', stops: twoTone(primary.oklch, secondary.oklch) },
    { key: 'accent', name: '亮點漸層', desc: '主色到點綴色，適合按鈕或重點區塊，少量使用', stops: twoTone(primary.oklch, accent.oklch) },
    { key: 'deep', name: '深色沉穩', desc: '主色與輔色調深，適合深色封面配淺色字', stops: twoTone([0.34, Math.min(Cp, 0.1), Hp], [0.44, Math.min(Cs, 0.1), Hs]) },
  ];
  return list.map((g) => ({ ...g, css: gradientCss(g.stops), text: textOnGradient(g.stops, [text.hex, background.hex], min) }));
}
