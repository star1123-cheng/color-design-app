// 推薦流程（SPEC 第 5 節）：選色 → 柔化主色 → 輔色候選 → 補底色、字色、點綴色 → 對比度修正 → 評分排序
import { hexToOklch, normalizeHex, hueDiff, normalizeHue } from './oklch.js';
import { quantize, maxChroma } from './gamut.js';
import { contrastRatio, adjustForContrast, CONTRAST } from './contrast.js';
import { secondaryCandidates, createRng, hashString } from './harmony.js';
import { STYLE_PREFS, INSUFFICIENT_STYLES, within } from './rules.js';
import { checkGrayscale, checkCvd, cvdWarning, GRAYSCALE_MIN_DIFF } from './cvd.js';
import { SCHEMA_VERSION } from '../data/schema.js';
import { SCENES, typographyFor, minTextContrast } from '../data/presets.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

// 產生值刻意留在 SPEC 4.2 範圍內側（HEX 量化會讓 L、C 偏移約 0.002）
const PRIMARY_L = [0.485, 0.825];
const PRIMARY_C = [0.03, 0.155];
const MARGIN = 0.003;

/** 投影模式（SPEC 4.5 第 1 點）：正文 7:1、大面積 C ≤ 0.12、底色 L ≥ 0.95 */
export const PROJECTION = { bgLmin: 0.95, largeAreaCmax: 0.12 };

// 商務（SPEC 4.6）：整組平均 C ≤ 0.05。點綴色 C 至少 0.10（4.2），所以主色、輔色、字色的彩度都要壓低
const BUSINESS = { primaryC: [0.03, 0.045], secondaryC: { 冷暖對比型: 0.045, 深淺對比型: 0.03, 同色系型: 0.03, 中性輔色型: 0.02 }, accentC: 0.108, textC: 0.02 };

/** 風格偏好的中文說明（介面與警告共用） */
export const STYLE_HINTS = { 療癒: '粉、紫、橘色系', 清新: '青藍色系', 森系: '綠色系', 商務: '低彩度，搭一個深色' };

/** 依風格把主色彩度調進範圍（保留使用者的色相）；回傳調整後的 OKLCH 與提醒 */
function applyStyle(style, lch) {
  const pref = STYLE_PREFS[style];
  if (!pref || INSUFFICIENT_STYLES.includes(style)) return { oklch: lch, warnings: [] };
  const [L, C, H] = lch;
  const warnings = [];
  const [lo, hi] = pref.darkLmax !== undefined
    ? BUSINESS.primaryC
    : [Math.max(pref.C[0] + MARGIN, PRIMARY_C[0]), Math.min(pref.C[1] - MARGIN, PRIMARY_C[1])];
  const nc = clamp(C, lo, hi);
  if (nc !== C) warnings.push(`已依「${style}」風格調整主色的鮮豔程度`);
  if (pref.H && !pref.H.some((r) => within(H, r))) {
    warnings.push(`你選的顏色不是「${style}」常見的${STYLE_HINTS[style]}，已保留你的色相`);
  }
  return { oklch: [L, nc, H], warnings };
}

/**
 * 產生 id（SPEC 3.1：crypto.randomUUID()）。
 * 瀏覽器只在安全環境（localhost、https）提供 randomUUID；手機以區網 http 開啟時沒有，
 * 此時改用 getRandomValues 組出同格式的 UUID v4。
 */
export function makeId(c = globalThis.crypto) {
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // 版本 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 變體
  const hex = [...b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 主色柔化：超出範圍時夾回範圍內，保留原色相 */
export function softenPrimary(lch) {
  const [L, C, H] = lch;
  const out = [clamp(L, ...PRIMARY_L), clamp(C, ...PRIMARY_C), H];
  return { oklch: out, softened: out[0] !== L || out[1] !== C };
}

/** 暖色判斷（用於字色色相） */
const isWarm = (H) => H < 110 || H >= 330;

// 底色家族（SPEC 4.2）：色調底（沿用配色的色相）、暖、冷、中性
export const BG_FAMILIES = ['tint', 'warm', 'cool', 'neutral'];
// 風格對底色的限制（SPEC 4.6）：療癒、森系＝暖白或色調底；清新＝暖白、中性白或色調底；其餘不限
export const STYLE_BG = { 療癒: ['warm', 'tint'], 森系: ['warm', 'tint'], 清新: ['warm', 'neutral', 'tint'] };
// 依候選順序（冷暖 ×3、深淺 ×2、同色系 ×2、中性輔色）安排底色，讓最後挑出的 5 組底色有變化
const BG_ORDER = ['tint', 'tint', 'tint', 'neutral', 'neutral', 'tint', 'cool', 'warm'];

/**
 * 依底色家族產生底色；warm 的亂數呼叫順序與舊版相同，結果不變。
 * tint（色調底）：取 hue 的淡色，投影模式維持 L ≥ 0.95（SPEC 4.5）。
 */
export function makeBackground(rng, { family = 'warm', hue = 80, projection = false } = {}) {
  const j = rng();
  if (family === 'tint') {
    const L = projection ? 0.958 + j * 0.008 : 0.935 + j * 0.02;                                   // SPEC：L 0.92–0.98
    return quantize([L, Math.min(0.028, 0.018 + rng() * 0.008, maxChroma(L, hue) - 0.004), hue]); // SPEC：C ≤ 0.035
  }
  if (family === 'cool') return quantize([0.965 + j * 0.01, 0.006 + rng() * 0.004, 245 + rng() * 30]); // SPEC：L 0.93–0.98、C ≤ 0.012、H 230–290
  if (family === 'neutral') return quantize([0.96 + j * 0.015, 0.001 + rng() * 0.003, 0]);             // SPEC：C ≤ 0.006
  return quantize([0.955 + j * 0.01, 0.012 + rng() * 0.004, 80 + rng() * 10]);                         // 暖底（舊版）
}

/** 第 i 個候選用哪種底色：先照 BG_ORDER，風格不允許時改用允許清單輪流 */
function familyFor(i, families) {
  const want = BG_ORDER[i % BG_ORDER.length];
  return families.includes(want) ? want : families[i % families.length];
}

/**
 * 字色：主色暖時取 H 45°、冷時取 H 240°，從 L 0.30 開始，依門檻做對比度修正（只調 L，最多 ±0.30）。
 * @returns {{ hex: string, oklch: number[], ok: boolean, ratio: number, warning: string|null }}
 */
export function makeText(primary, bgHex, minContrast, C = 0.035) {
  const H = isWarm(primary[2]) ? 45 : 240;
  const adj = adjustForContrast([0.3, C, H], bgHex, minContrast);
  const q = quantize(adj.oklch);
  const ratio = contrastRatio(q.hex, bgHex);
  const warning = adj.ok ? null : `字色對底色的對比度只有 ${ratio.toFixed(2)}:1，未達 ${minContrast}:1`;
  return { ...q, ok: adj.ok, ratio, warning };
}

// 點綴色色相（2026-10-06 使用者決定）：預設取主色的相鄰色相（±35°，挑離輔色較遠的一側），
// 彩度壓在 SPEC 下限附近，讓點綴色與整組同一色系、不突兀。far 為舊算法（離主色與輔色都最遠），範本庫產生腳本沿用。
const ACCENT_NEAR = { offset: 35, maxC: 0.108 };

/** 點綴色：在 L 0.605–0.70 找彩度 ≥ 0.105 的位置（彩度上限 maxC） */
function makeAccent(primary, secondary, bgHex, maxC = 0.125, hueMode = 'near') {
  let bestH = 0, bestScore = -1;
  if (hueMode === 'far') {
    for (let h = 0; h < 360; h += 5) {
      const score = Math.min(hueDiff(h, primary[2]), hueDiff(h, secondary[2]));
      if (score > bestScore) { bestScore = score; bestH = h; }
    }
  } else {
    for (const sign of [1, -1]) {
      const h = normalizeHue(primary[2] + sign * ACCENT_NEAR.offset);
      const score = hueDiff(h, secondary[2]);
      if (score > bestScore) { bestScore = score; bestH = h; }
    }
    maxC = Math.min(maxC, ACCENT_NEAR.maxC);
  }
  let lch = null;
  for (let L = 0.605; L <= 0.70 + 1e-9; L += 0.005) {
    const mc = maxChroma(L, bestH);
    if (mc >= 0.105) { lch = [L, Math.min(maxC, mc - 0.002), bestH]; break; }
  }
  if (!lch) lch = [0.605, Math.min(maxC, maxChroma(0.605, bestH) - 0.002), bestH];
  // 圖形元件 3:1（SPEC 4.3）；只在點綴色 L 範圍內往下調
  const adj = adjustForContrast(lch, bgHex, CONTRAST.graphic, Math.max(0, lch[0] - 0.605));
  return { ...quantize(adj.oklch), ok: adj.ok };
}

function buildOne(primary, candidate, ctx, rng, family) {
  const warnings = [...ctx.baseWarnings];
  const business = ctx.style === '商務';
  // 色調底：同色系、中性輔色型沿用主色色相（整組更和諧）；對比型沿用輔色色相（與主色互相襯托）
  const harmonious = candidate.type === '同色系型' || candidate.type === '中性輔色型';
  const hue = harmonious ? primary.oklch[2] : candidate.oklch[2];
  const background = makeBackground(rng, { family, hue, projection: ctx.projection });
  let [sL, sC, sH] = candidate.oklch;
  if (business) sC = BUSINESS.secondaryC[candidate.type] ?? sC;
  if (ctx.projection) sC = Math.min(sC, PROJECTION.largeAreaCmax - MARGIN); // 投影：大面積 C ≤ 0.12
  const secondary = quantize([sL, sC, sH]);
  const text = makeText(primary.oklch, background.hex, ctx.minContrast, business ? BUSINESS.textC : undefined);
  const accent = makeAccent(primary.oklch, secondary.oklch, background.hex, business ? BUSINESS.accentC : undefined, ctx.accentHue);

  const textRatio = contrastRatio(text.hex, background.hex);
  const accentRatio = contrastRatio(accent.hex, background.hex);
  const gray = checkGrayscale(primary.hex, secondary.hex);
  const cvd = checkCvd(primary.hex, secondary.hex);

  if (text.warning) warnings.push(text.warning);
  if (!accent.ok) warnings.push(`點綴色對底色的對比度只有 ${accentRatio.toFixed(2)}:1，當按鈕邊框或圖表線條可能不夠清楚`);
  if (!gray.ok) warnings.push('主色與輔色明度接近，列印成黑白時兩色難以分辨');
  const cvdMsg = cvdWarning(cvd);
  if (cvdMsg) warnings.push(cvdMsg);

  // 評分：對比度達標數、明度差、冷暖對比型（預設）優先。
  // 刻意維持階段 2 的算法（明度差用 OKLCH L，不含色弱）：範本庫的引擎補色取推薦第一組，
  // 改變排序會讓已審核的範本變色。是否把色弱與灰階新算法納入排序，待使用者決定。
  const lDiff = Math.abs(primary.oklch[0] - secondary.oklch[0]);
  const score = (text.ok ? 3 : 0) + (accent.ok ? 2 : 0) + (lDiff >= GRAYSCALE_MIN_DIFF ? 2 : 0)
    + (candidate.type === '冷暖對比型' ? 0.5 : 0);

  const color = (c) => ({ hex: c.hex, oklch: [round(c.oklch[0], 3), round(c.oklch[1], 3), round(normalizeHue(c.oklch[2]), 1)] });
  return {
    score,
    palette: {
      schemaVersion: SCHEMA_VERSION,
      id: makeId(),
      name: candidate.type,
      mode: ctx.mode,
      context: { scene: ctx.mode === 'teacher' ? ctx.scene : null, style: ctx.style, projection: ctx.projection },
      colors: {
        primary: color(primary),
        secondary: color(secondary),
        background: color(background),
        text: color(text),
        accent: color(accent),
      },
      checks: {
        contrast: { textOnBackground: round(textRatio, 2), accentOnBackground: round(accentRatio, 2) },
        grayscaleLDiff: round(gray.diff, 3),
        cvd,
        warnings,
      },
      typography: typographyFor(ctx.scene, ctx.projection),
    },
  };
}

/**
 * 從已排序的候選挑出 n 組：每種輔色類型先取分數最高的一組，剩下的名額優先給同色系型（相近色、和諧感），
 * 再依分數補滿；結果維持原排序。只有舊版 5 組候選時，結果與舊版相同。
 */
export function pickDiverse(sorted, n = 5) {
  const picked = new Set();
  const types = new Set();
  for (const r of sorted) {
    if (picked.size < n && !types.has(r.palette.name)) { types.add(r.palette.name); picked.add(r); }
  }
  const rest = [...sorted.filter((r) => r.palette.name === '同色系型'), ...sorted];
  for (const r of rest) if (picked.size < n) picked.add(r);
  return sorted.filter((r) => picked.has(r));
}

/**
 * 依選色產生 3–5 組推薦（SPEC 第 5 節）。
 * @param {string} seedHex 使用者選的顏色
 * @param {{ mode?: 'teacher'|'public', scene?: string, style?: string|null, projection?: boolean, seed?: number, bgFamilies?: string[], extendedTypes?: boolean, accentHue?: 'near'|'far' }} [opts]
 *   bgFamilies：限定底色家族；extendedTypes：false 時只產生舊版的冷暖、深淺對比型候選；
 *   accentHue：點綴色取主色相鄰色相（near，預設）或舊版最遠色相（far）。
 *   範本庫腳本傳 { bgFamilies: ['warm'], extendedTypes: false, accentHue: 'far' } 可維持舊版結果
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
  let primaryLch = soft.oklch;
  if (style && INSUFFICIENT_STYLES.includes(style)) {
    baseWarnings.push(`「${style}」風格規則建置中，暫以一般規則推薦`);
  } else if (style && !STYLE_PREFS[style]) {
    baseWarnings.push(`不認得的風格「${style}」，以一般規則推薦`);
  } else if (style) {
    const st = applyStyle(style, primaryLch);
    primaryLch = st.oklch;
    baseWarnings.push(...st.warnings);
  }

  const primary = quantize(primaryLch);
  const ctx = { mode, scene, style, projection, minContrast: minTextContrast(scene, projection), baseWarnings,
    accentHue: opts.accentHue === 'far' ? 'far' : 'near' };
  const families = (opts.bgFamilies ?? STYLE_BG[style] ?? BG_FAMILIES).filter((f) => BG_FAMILIES.includes(f));
  if (families.length === 0) families.push('warm');
  const results = secondaryCandidates(primary.oklch, rng, { extended: opts.extendedTypes !== false }).map((c, i) => {
    const r = buildOne(primary, c, ctx, rng, familyFor(i, families));
    r.order = i;
    return r;
  });
  results.sort((a, b) => b.score - a.score || a.order - b.order);
  const counts = {};
  return pickDiverse(results, 5).map(({ palette }) => {
    counts[palette.name] = (counts[palette.name] ?? 0) + 1;
    return { ...palette, name: `${palette.name} ${counts[palette.name]}` };
  });
}

/**
 * 投影模式檢查（SPEC 4.5 第 1 點）：正文 7:1、底色 L ≥ 0.95、大面積（底色、輔色）C ≤ 0.12。
 * @param {object} palette SPEC 3.1 配色
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function checkProjection(palette) {
  const { colors, checks } = palette;
  const issues = [];
  if (checks.contrast.textOnBackground < CONTRAST.projectionText) issues.push(`字和底色的對比不到 ${CONTRAST.projectionText}:1`);
  if (colors.background.oklch[0] < PROJECTION.bgLmin) issues.push('底色不夠亮');
  if (['background', 'secondary'].some((r) => colors[r].oklch[1] > PROJECTION.largeAreaCmax)) issues.push('大面積的顏色太鮮豔');
  return { ok: issues.length === 0, issues };
}
