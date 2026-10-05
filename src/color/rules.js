// SPEC v0.3 第 4.2、4.4、4.6 節的範圍與驗證器
// 數值只依規則集整理（見 docs/rules-changelog.md）；修改前必須先改 SPEC 並記錄 changelog。
import { hueDiff } from './oklch.js';

export const RANGES = {
  primary: { L: [0.48, 0.83], C: [0.025, 0.16] },
  secondary: [
    { name: '冷暖對比型', L: [0.62, 0.91], C: [0.04, 0.145], dH: [110, 180] },
    { name: '深淺對比型', dLmin: 0.25, C: [0.01, 0.12], dH: [0, 95] },
    { name: '同色系型', dL: [0, 0.25], C: [0.01, 0.11], dH: [0, 60] },
    { name: '中性輔色型', L: [0.55, 0.91], C: [0, 0.04] },
  ],
  background: [
    { name: '暖底', L: [0.89, 0.98], C: [0.005, 0.035], H: [60, 110] },
    { name: '冷底', L: [0.93, 0.98], C: [0, 0.012], H: [230, 290] },
    { name: '中性底', L: [0.93, 0.98], C: [0, 0.006] },
    { name: '色調底', L: [0.92, 0.98], C: [0, 0.035] },
  ],
  text: { L: [0.20, 0.50], Cmax: 0.065, H: [[210, 265], [30, 60]], neutralC: 0.025 },
  accent: { L: [0.60, 0.78], C: [0.10, 0.14] },
  gradient: [
    { name: '全幅型', hueSpan: 25, lightMin: 0.92, dark: [0.20, 0.60], peak: 'middle' },
    { name: '淺色型', hueSpan: 25, lightMin: 0.96, dark: [0.80, 0.88], peak: 'darkest' },
  ],
  largeAreaCmax: 0.07,
};

// SPEC 4.6：復古、夜間樣本不足，不寫入引擎
export const STYLE_PREFS = {
  療癒: { H: [[290, 360], [0, 60]], C: [0.04, 0.165], background: '暖底或色調底' },
  清新: { H: [[180, 255]], C: [0.025, 0.08], background: '暖白、中性白或色調底' },
  森系: { H: [[130, 180]], C: [0.025, 0.065], background: '暖底或色調底' },
  商務: { darkLmax: 0.52, avgCmax: 0.05, background: '暖底' },
};
export const INSUFFICIENT_STYLES = ['復古', '夜間'];

export const within = (v, r) => !r || (v >= r[0] && v <= r[1]);

/**
 * 檢查單一顏色是否符合角色範圍。
 * @param {string} role primary | secondary | background | text | accent
 * @param {number[]} lch 該色 OKLCH
 * @param {number[]} [primary] 主色 OKLCH（輔色需要）
 * @param {object} [ranges] 預設 RANGES；可傳入其他版本比較
 * @returns {{ ok: boolean, type: string|null }}
 */
export function checkRole(role, lch, primary, ranges = RANGES) {
  const [L, C, H] = lch;
  const hit = (list) => list.find(Boolean) ?? null;
  switch (role) {
    case 'primary':
      return { ok: within(L, ranges.primary.L) && within(C, ranges.primary.C), type: null };
    case 'secondary': {
      const dH = hueDiff(H, primary[2]);
      const dL = Math.abs(L - primary[0]);
      const t = hit(ranges.secondary.map((s) => (within(L, s.L) && within(C, s.C) && within(dH, s.dH)
        && within(dL, s.dL) && (s.dLmin === undefined || dL >= s.dLmin) ? s.name : null)));
      return { ok: Boolean(t), type: t };
    }
    case 'background': {
      const t = hit(ranges.background.map((s) => (within(L, s.L) && within(C, s.C) && within(H, s.H) ? s.name : null)));
      return { ok: Boolean(t), type: t };
    }
    case 'text': {
      const t = ranges.text;
      const neutral = C <= t.neutralC;
      const ok = within(L, t.L) && C <= t.Cmax && (neutral || t.H.some((h) => within(H, h)));
      return { ok, type: neutral ? '中性' : null };
    }
    case 'accent':
      return { ok: within(L, ranges.accent.L) && within(C, ranges.accent.C), type: null };
    default:
      throw new Error(`未知角色：${role}`);
  }
}

/** 檢查一組五色是否全部符合 4.2（輸入為 { primary: lch, ... }） */
export function checkPalette(colors, ranges = RANGES) {
  const result = {};
  for (const role of ['primary', 'secondary', 'background', 'text', 'accent']) {
    result[role] = checkRole(role, colors[role], colors.primary, ranges);
  }
  result.ok = Object.values(result).every((r) => r.ok);
  return result;
}

function hueSpan(hues) {
  if (hues.length < 2) return 0;
  const s = [...hues].sort((a, b) => a - b);
  let gap = 0;
  for (let i = 0; i < s.length; i++) gap = Math.max(gap, (i === s.length - 1 ? s[0] + 360 : s[i + 1]) - s[i]);
  return 360 - gap;
}

/** 檢查漸層（4.4）：輸入為 OKLCH 陣列，順序不限 */
export function checkGradient(list, ranges = RANGES) {
  const cs = [...list].sort((a, b) => b[0] - a[0]); // 由淺到深
  const span = hueSpan(cs.filter((c) => c[1] > 0.02).map((c) => c[2]));
  const peak = cs.reduce((a, c, i) => (c[1] > cs[a][1] ? i : a), 0);
  const t = ranges.gradient.find((g) => span <= g.hueSpan && cs[0][0] >= g.lightMin
    && within(cs[cs.length - 1][0], g.dark)
    && (g.peak === 'middle' ? peak > 0 && peak < cs.length - 1 : peak === cs.length - 1));
  return { ok: Boolean(t), type: t?.name ?? null, hueSpan: span };
}

/** 檢查風格偏好（4.6）；樣本不足的風格回傳 null */
export function checkStyle(style, colors, primary) {
  const pref = STYLE_PREFS[style];
  if (!pref) return null;
  if (pref.darkLmax !== undefined) {
    const avgC = colors.reduce((a, c) => a + c[1], 0) / colors.length;
    return colors.some((c) => c[0] <= pref.darkLmax) && avgC <= pref.avgCmax;
  }
  return pref.H.some((h) => within(primary[2], h)) && within(primary[1], pref.C);
}
