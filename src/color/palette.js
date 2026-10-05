// 推薦流程（SPEC 第 5 節）：選色 → 柔化主色 → 輔色候選 → 補底色、字色、點綴色 → 對比度修正 → 評分排序
import { hexToOklch, normalizeHex, hueDiff, normalizeHue } from './oklch.js';
import { quantize, maxChroma } from './gamut.js';
import { contrastRatio, adjustForContrast, CONTRAST } from './contrast.js';
import { secondaryCandidates, createRng, hashString } from './harmony.js';
import { STYLE_PREFS, INSUFFICIENT_STYLES } from './rules.js';
import { SCHEMA_VERSION } from '../data/schema.js';
import { SCENES, typographyFor, minTextContrast } from '../data/presets.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

// 產生值刻意留在 SPEC 4.2 範圍內側（HEX 量化會讓 L、C 偏移約 0.002）
const PRIMARY_L = [0.485, 0.825];
const PRIMARY_C = [0.03, 0.155];
const GRAYSCALE_MIN_DIFF = 0.12; // SPEC 4.5 第 2 點

/** 主色柔化：超出範圍時夾回範圍內，保留原色相 */
export function softenPrimary(lch) {
  const [L, C, H] = lch;
  const out = [clamp(L, ...PRIMARY_L), clamp(C, ...PRIMARY_C), H];
  return { oklch: out, softened: out[0] !== L || out[1] !== C };
}

/** 暖色判斷（用於字色色相） */
const isWarm = (H) => H < 110 || H >= 330;

function makeBackground(rng, { cool }) {
  if (cool) return quantize([0.97, 0.006, 250]);                          // 冷底
  return quantize([0.955 + rng() * 0.01, 0.012 + rng() * 0.004, 80 + rng() * 10]); // 暖底
}

/**
 * 字色：主色暖時取 H 45°、冷時取 H 240°，從 L 0.30 開始，依門檻做對比度修正（只調 L，最多 ±0.30）。
 * @returns {{ hex: string, oklch: number[], ok: boolean, ratio: number, warning: string|null }}
 */
export function makeText(primary, bgHex, minContrast) {
  const H = isWarm(primary[2]) ? 45 : 240;
  const adj = adjustForContrast([0.3, 0.035, H], bgHex, minContrast);
  const q = quantize(adj.oklch);
  const ratio = contrastRatio(q.hex, bgHex);
  const warning = adj.ok ? null : `字色對底色的對比度只有 ${ratio.toFixed(2)}:1，未達 ${minContrast}:1`;
  return { ...q, ok: adj.ok, ratio, warning };
}

/** 點綴色：色相離主色與輔色都最遠；在 L 0.605–0.70 找彩度 ≥ 0.105 的位置 */
function makeAccent(primary, secondary, bgHex) {
  let bestH = 0, bestScore = -1;
  for (let h = 0; h < 360; h += 5) {
    const score = Math.min(hueDiff(h, primary[2]), hueDiff(h, secondary[2]));
    if (score > bestScore) { bestScore = score; bestH = h; }
  }
  let lch = null;
  for (let L = 0.605; L <= 0.70 + 1e-9; L += 0.005) {
    const mc = maxChroma(L, bestH);
    if (mc >= 0.105) { lch = [L, Math.min(0.125, mc - 0.002), bestH]; break; }
  }
  if (!lch) lch = [0.605, Math.min(0.125, maxChroma(0.605, bestH) - 0.002), bestH];
  // 圖形元件 3:1（SPEC 4.3）；只在點綴色 L 範圍內往下調
  const adj = adjustForContrast(lch, bgHex, CONTRAST.graphic, Math.max(0, lch[0] - 0.605));
  return { ...quantize(adj.oklch), ok: adj.ok };
}

function buildOne(primary, candidate, ctx, rng) {
  const warnings = [...ctx.baseWarnings];
  const background = makeBackground(rng, { cool: ctx.projection });
  const secondary = quantize(candidate.oklch);
  const text = makeText(primary.oklch, background.hex, ctx.minContrast);
  const accent = makeAccent(primary.oklch, secondary.oklch, background.hex);

  const textRatio = contrastRatio(text.hex, background.hex);
  const accentRatio = contrastRatio(accent.hex, background.hex);
  const grayDiff = Math.abs(primary.oklch[0] - secondary.oklch[0]);

  if (text.warning) warnings.push(text.warning);
  if (!accent.ok) warnings.push(`點綴色對底色的對比度只有 ${accentRatio.toFixed(2)}:1，當按鈕邊框或圖表線條可能不夠清楚`);
  if (grayDiff < GRAYSCALE_MIN_DIFF) warnings.push('主色與輔色明度接近，列印成黑白時兩色難以分辨');

  // 評分：對比度達標數、灰階可分辨、冷暖對比型（預設）優先
  const score = (text.ok ? 3 : 0) + (accent.ok ? 2 : 0) + (grayDiff >= GRAYSCALE_MIN_DIFF ? 2 : 0)
    + (candidate.type === '冷暖對比型' ? 0.5 : 0);

  const color = (c) => ({ hex: c.hex, oklch: [round(c.oklch[0], 3), round(c.oklch[1], 3), round(normalizeHue(c.oklch[2]), 1)] });
  return {
    score,
    palette: {
      schemaVersion: SCHEMA_VERSION,
      id: globalThis.crypto.randomUUID(),
      name: candidate.type,
      mode: ctx.mode,
      context: { scene: ctx.mode === 'teacher' ? ctx.scene : null, style: ctx.mode === 'public' ? ctx.style : null, projection: ctx.projection },
      colors: {
        primary: color(primary),
        secondary: color(secondary),
        background: color(background),
        text: color(text),
        accent: color(accent),
      },
      checks: {
        contrast: { textOnBackground: round(textRatio, 2), accentOnBackground: round(accentRatio, 2) },
        grayscaleLDiff: round(grayDiff, 3),
        cvd: { protan: null, deutan: null, tritan: null }, // 階段 3 實作
        warnings,
      },
      typography: typographyFor(ctx.scene, ctx.projection),
    },
  };
}

/**
 * 依選色產生 3–5 組推薦（SPEC 第 5 節）。
 * @param {string} seedHex 使用者選的顏色
 * @param {{ mode?: 'teacher'|'public', scene?: string, style?: string|null, projection?: boolean, seed?: number }} [opts]
 * @returns {object[]} 符合 SPEC 3.1 的配色陣列（已排序）
 */
export function recommend(seedHex, opts = {}) {
  const hex = normalizeHex(seedHex);
  const mode = opts.mode === 'public' ? 'public' : 'teacher';
  const scene = SCENES[opts.scene] ? opts.scene : 'slides';
  const style = opts.style ?? null;
  const projection = mode === 'teacher' && Boolean(opts.projection);
  const rng = createRng(opts.seed ?? hashString(`${hex}|${mode}|${scene}|${style}|${projection}`));

  const baseWarnings = [];
  const soft = softenPrimary(hexToOklch(hex));
  if (soft.softened) baseWarnings.push('選色超出建議範圍，已產生保留原色相的柔化版當主色');
  if (mode === 'public' && style && INSUFFICIENT_STYLES.includes(style)) {
    baseWarnings.push(`「${style}」風格規則建置中，暫以一般規則推薦`);
  } else if (mode === 'public' && style && !STYLE_PREFS[style]) {
    baseWarnings.push(`不認得的風格「${style}」，以一般規則推薦`);
  }

  const primary = quantize(soft.oklch);
  const ctx = { mode, scene, style, projection, minContrast: minTextContrast(scene, projection), baseWarnings };
  const results = secondaryCandidates(primary.oklch, rng).map((c, i) => {
    const r = buildOne(primary, c, ctx, rng);
    r.order = i;
    return r;
  });
  results.sort((a, b) => b.score - a.score || a.order - b.order);
  const counts = {};
  return results.map(({ palette }) => {
    counts[palette.name] = (counts[palette.name] ?? 0) + 1;
    return { ...palette, name: `${palette.name} ${counts[palette.name]}` };
  });
}
