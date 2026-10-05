// 輔色候選（SPEC 第 5 節第 3 步）：冷暖對比型 3 組、深淺對比型 2 組；extended 時再加同色系型 2 組、中性輔色型 1 組
// 角度與明度略微抖動，使用固定亂數種子以便測試重現
import { normalizeHue } from './oklch.js';

/** 可重現的亂數產生器（mulberry32），回傳 0–1 */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 字串 → 32 位元整數種子（FNV-1a） */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (const ch of String(str)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const jitter = (rng, amount) => (rng() * 2 - 1) * amount;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 產生時刻意留在 SPEC 範圍內側，避免 HEX 量化後超出邊界
// 冷暖對比型的明度差約 0.14，讓灰階列印時仍可分辨（SPEC 4.5 要求 L 差 ≥ 0.12）
const COOL_WARM = { dH: [130, 145, 160], dHJitter: 5, dL: 0.14, L: [0.64, 0.88], C: [0.05, 0.12] };
const LIGHT_DARK = { dH: [45, 75], dHJitter: 5, dL: 0.31, L: [0.22, 0.92], C: [0.03, 0.09] };
// 同色系型（SPEC 4.2：與主色 L 差 0–0.25、C 0.01–0.11、色相差 0–60°）：相近色相、明度分層，L 差 0.16 讓灰階列印仍可分辨
const SAME_HUE = { dH: [25, -35], dL: 0.16, C: [0.02, 0.105], cRatio: 0.85 };
// 中性輔色型（SPEC 4.2：L 0.55–0.91、C ≤ 0.04）：沿用主色色相、帶一點色調的灰米色
const NEUTRAL = { L: [0.555, 0.9], dL: 0.25, C: [0.008, 0.03], cRatio: 0.25 };

/**
 * @param {number[]} primary 主色 OKLCH
 * @param {() => number} rng
 * @param {{ extended?: boolean }} [opts] extended：再加同色系型 2 組、中性輔色型 1 組
 * @returns {{ type: string, oklch: number[] }[]}
 */
export function secondaryCandidates(primary, rng, { extended = false } = {}) {
  const [pL, pC, pH] = primary;
  const out = [];

  COOL_WARM.dH.forEach((base, i) => {
    const sign = i % 2 === 0 ? 1 : -1;
    const H = normalizeHue(pH + sign * (base + jitter(rng, COOL_WARM.dHJitter)));
    // 優先比主色亮；超出範圍時改成比主色暗
    const dL = COOL_WARM.dL + jitter(rng, 0.015);
    const L = clamp(pL + dL <= COOL_WARM.L[1] ? pL + dL : pL - dL, ...COOL_WARM.L);
    const C = clamp(pC * 0.75, ...COOL_WARM.C);
    out.push({ type: '冷暖對比型', oklch: [L, C, H] });
  });

  LIGHT_DARK.dH.forEach((base, i) => {
    const sign = i % 2 === 0 ? 1 : -1;
    const H = normalizeHue(pH + sign * (base + jitter(rng, LIGHT_DARK.dHJitter)));
    const dL = LIGHT_DARK.dL + jitter(rng, 0.02);
    const L = clamp(pL >= 0.62 ? pL - dL : pL + dL, ...LIGHT_DARK.L);
    const C = clamp(pC * 0.6, ...LIGHT_DARK.C);
    out.push({ type: '深淺對比型', oklch: [L, C, H] });
  });

  // 和諧型候選不使用亂數，附加在後面，前 5 組的亂數序列不變（範本庫腳本關掉 extended 可得舊版結果）
  if (extended) {
    SAME_HUE.dH.forEach((d) => {
      const L = pL >= 0.62 ? pL - SAME_HUE.dL : pL + SAME_HUE.dL;
      const C = clamp(pC * SAME_HUE.cRatio, ...SAME_HUE.C);
      out.push({ type: '同色系型', oklch: [L, C, normalizeHue(pH + d)] });
    });
    const darker = pL - NEUTRAL.dL;
    const L = darker >= NEUTRAL.L[0] ? darker : Math.min(NEUTRAL.L[1], pL + NEUTRAL.dL);
    out.push({ type: '中性輔色型', oklch: [L, clamp(pC * NEUTRAL.cRatio, ...NEUTRAL.C), pH] });
  }

  return out;
}
