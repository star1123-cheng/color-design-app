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

/** 漸層方向（2026-10-06 使用者新增：可自選）；diag 為預設，左上到右下最常見 */
export const GRADIENT_DIRS = {
  diag: { label: '斜角', desc: '左上到右下', css: 'linear-gradient(135deg' },
  h: { label: '左到右', desc: '由左到右', css: 'linear-gradient(90deg' },
  v: { label: '上到下', desc: '由上到下', css: 'linear-gradient(180deg' },
  radial: { label: '放射', desc: '從左上角往外擴散', css: 'radial-gradient(circle at top left' },
};

/** 漸層用在哪個元件（2026-10-06 使用者新增：可自選）；hero 為預設 */
export const GRADIENT_TARGETS = {
  background: { label: '整頁背景', desc: '整頁或整張投影片的背景' },
  hero: { label: '橫幅／主視覺', desc: '標題橫幅、網頁主視覺區塊' },
  button: { label: '按鈕與標籤', desc: '按鈕、題號、表頭等小面積重點' },
  deco: { label: '裝飾圖形', desc: '圓形、色塊等裝飾' },
};

/**
 * 產生 CSS 語法，例如 linear-gradient(135deg, #AAAAAA 0%, #BBBBBB 100%)。
 * @param {{hex: string}[]} stops
 * @param {string|number} [dir] GRADIENT_DIRS 的 key，或直接給角度（度）
 */
export function gradientCss(stops, dir = 'diag') {
  const last = stops.length - 1;
  const parts = stops.map((s, i) => `${s.hex} ${last ? Math.round((i / last) * 100) : 0}%`);
  const head = typeof dir === 'number' ? `linear-gradient(${dir}deg` : (GRADIENT_DIRS[dir] ?? GRADIENT_DIRS.diag).css;
  return `${head}, ${parts.join(', ')})`;
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

/** 相近色：主色的色相往輔色那一側轉 35°，明度略亮、彩度不超過 0.12 */
function analogous(primary, secondary) {
  const [L, C, H] = primary;
  let d = secondary[2] - H;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  const sign = secondary[1] < 0.02 || d === 0 ? 1 : Math.sign(d);
  const c = Math.min(Math.max(C, 0.06), 0.12);
  return [[L, c, H], [Math.min(0.86, L + 0.06), c, (((H + sign * 35) % 360) + 360) % 360]];
}

/** 5 種漸層建議的 key（順序與 gradientSuggestions 相同；收藏資料驗證也用這份） */
export const GRADIENT_KEYS = ['soft', 'analog', 'main', 'accent', 'deep'];

/**
 * 漸層搭配建議（5 種）。
 * @param {Record<string, {hex: string, oklch: number[]}>} colors 配色的五個角色
 * @param {{ min?: number, dir?: string }} [opts] min：放字需要的對比度；dir：GRADIENT_DIRS 的 key
 * @returns {{ key: string, name: string, desc: string, stops: {hex: string, oklch: number[]}[], css: string, text: {hex: string|null, ratio: number} }[]}
 */
export function gradientSuggestions(colors, { min = 4.5, dir = 'diag' } = {}) {
  const { primary, secondary, accent, background, text } = colors;
  const [, Cp, Hp] = primary.oklch;
  const [, Cs, Hs] = secondary.oklch;
  const list = [
    { key: 'soft', name: '柔和同色', desc: '主色的淡淡深淺，適合整頁背景', stops: makeGradient(primary.oklch, { type: 'light' }).filter((_, i) => i % 2 === 0) },
    { key: 'analog', name: '相近色漸層', desc: '主色到相鄰的色相，柔順又有變化，適合主視覺或橫幅', stops: twoTone(...analogous(primary.oklch, secondary.oklch)) },
    { key: 'main', name: '主輔漸層', desc: '主色到輔色，適合封面、標題橫幅', stops: twoTone(primary.oklch, secondary.oklch) },
    { key: 'accent', name: '亮點漸層', desc: '主色到點綴色，適合按鈕或重點區塊，少量使用', stops: twoTone(primary.oklch, accent.oklch) },
    { key: 'deep', name: '深色沉穩', desc: '主色與輔色調深，適合深色封面配淺色字', stops: twoTone([0.34, Math.min(Cp, 0.1), Hp], [0.44, Math.min(Cs, 0.1), Hs]) },
  ];
  return list.map((g) => ({ ...g, css: gradientCss(g.stops, dir), text: textOnGradient(g.stops, [text.hex, background.hex], min) }));
}

/**
 * 使用者選定的漸層（含方向與用途）；沒選或 key 不存在時回傳 null。
 * @param {Record<string, {hex: string, oklch: number[]}>} colors
 * @param {{ key: string|null, target?: string, dir?: string, min?: number }} sel
 */
export function pickGradient(colors, { key, target = 'hero', dir = 'diag', min = 4.5 }) {
  if (!key) return null;
  const d = GRADIENT_DIRS[dir] ? dir : 'diag';
  const t = GRADIENT_TARGETS[target] ? target : 'hero';
  const g = gradientSuggestions(colors, { min, dir: d }).find((x) => x.key === key);
  return g ? { ...g, dir: d, target: t } : null;
}

/**
 * 同時選用多個漸層（2026-10-07 使用者新增）：每個用途（GRADIENT_TARGETS）最多一個。
 * 接受舊格式（單一物件）或新格式（陣列），回傳依用途順序排好、去掉不正確項目的陣列；同一用途重複時以後面的為準。
 * @param {unknown} v null、{ key, target, dir } 或其陣列
 * @returns {{ key: string, target: string, dir: string }[]}
 */
export function gradientList(v) {
  const byTarget = {};
  for (const g of Array.isArray(v) ? v : v ? [v] : []) {
    if (!g || !GRADIENT_KEYS.includes(g.key) || !Object.hasOwn(GRADIENT_TARGETS, g.target ?? '')) continue;
    byTarget[g.target] = { key: g.key, target: g.target, dir: Object.hasOwn(GRADIENT_DIRS, g.dir ?? '') ? g.dir : 'diag' };
  }
  return Object.keys(GRADIENT_TARGETS).filter((t) => byTarget[t]).map((t) => byTarget[t]);
}

/** 多個選用的漸層一次算好（沒選或 key 不存在的略過） */
export const pickGradients = (colors, sels, min = 4.5) =>
  gradientList(sels).map((s) => pickGradient(colors, { ...s, min })).filter(Boolean);
