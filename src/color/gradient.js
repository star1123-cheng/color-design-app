// 5 階漸層（SPEC 4.4）
// 全幅型（預設）：淺端 L ≥ 0.92、深端 0.20–0.60、中段彩度最高
// 淺色型：淺端 L ≥ 0.96、深端 0.80–0.88、最深階彩度最高
import { quantize } from './gamut.js';

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
