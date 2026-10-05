// 輔色候選（SPEC 第 5 節第 3 步）：冷暖對比型 3 組、深淺對比型 2 組
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

/**
 * @param {number[]} primary 主色 OKLCH
 * @param {() => number} rng
 * @returns {{ type: string, oklch: number[] }[]}
 */
export function secondaryCandidates(primary, rng) {
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

  return out;
}
