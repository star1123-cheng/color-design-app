import test from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../src/color/palette.js';
import { hexToOklch } from '../src/color/oklch.js';
import { contrastRatio } from '../src/color/contrast.js';

// 固定種子的偽亂數，產生 200 個測試色
function seeds(n) {
  let s = 12345;
  const out = [];
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const v = s & 0xffffff;
    out.push('#' + v.toString(16).padStart(6, '0').toUpperCase());
  }
  return out;
}

// 底色家族判斷（含 HEX 量化誤差的容許範圍）；色調底的 C 至少 0.017，與暖、冷、中性分得開
function family(bg) {
  const [L, C, H] = hexToOklch(bg);
  if (C <= 0.0055) return 'neutral';
  if (H >= 225 && H <= 295 && C <= 0.0125) return 'cool';
  if (H >= 60 && H <= 110 && C >= 0.010 && C < 0.017) return 'warm';
  if (L >= 0.918 && C >= 0.015 && C <= 0.036) return 'tint';
  return 'other';
}

test('底色都落在 SPEC 4.2 的色調、暖、冷、中性範圍內', () => {
  for (const hex of seeds(200)) {
    for (const p of recommend(hex, { mode: 'teacher', scene: 'slides' })) {
      const bg = p.colors.background.hex;
      assert.notEqual(family(bg), 'other', `${hex} → ${bg}`);
      assert.ok(hexToOklch(bg)[0] >= 0.918, `底色不夠亮 ${bg}`);
    }
  }
});

test('無風格時任何一種底色家族不超過 50%', () => {
  const count = { tint: 0, warm: 0, cool: 0, neutral: 0 };
  let total = 0;
  for (const hex of seeds(200)) {
    for (const p of recommend(hex, { mode: 'teacher', scene: 'slides' })) {
      count[family(p.colors.background.hex)]++;
      total++;
    }
  }
  for (const [k, v] of Object.entries(count)) {
    assert.ok(v / total <= 0.5, `${k} 佔 ${(v / total * 100).toFixed(1)}%`);
  }
});

test('每次推薦至少有 3 種底色家族，且至少 1 組色調底', () => {
  for (const hex of seeds(100)) {
    const set = new Set(recommend(hex, { mode: 'teacher', scene: 'slides' }).map((p) => family(p.colors.background.hex)));
    assert.ok(set.size >= 3 && set.has('tint'), `${hex} 只有 ${[...set]}`);
  }
});

test('風格限制底色：療癒、森系只用暖白或色調底；清新只用暖白、中性白或色調底', () => {
  const allow = { 療癒: ['warm', 'tint'], 森系: ['warm', 'tint'], 清新: ['warm', 'neutral', 'tint'] };
  for (const [style, ok] of Object.entries(allow)) {
    for (const hex of seeds(60)) {
      for (const p of recommend(hex, { mode: 'public', style })) {
        assert.ok(ok.includes(family(p.colors.background.hex)), `${style} ${hex}`);
      }
    }
  }
});

test('字色對底色對比度：一般 4.5:1、投影 7:1（容許 adjustForContrast 已標警告的組）', () => {
  for (const hex of seeds(100)) {
    for (const projection of [false, true]) {
      for (const p of recommend(hex, { mode: 'teacher', scene: 'slides', projection })) {
        const min = projection ? 7 : 4.5;
        const r = contrastRatio(p.colors.text.hex, p.colors.background.hex);
        if (r < min) assert.ok(p.checks.warnings.length > 0, `${hex} 對比 ${r.toFixed(2)} 但沒有警告`);
      }
    }
  }
});

test("bgFamilies: ['warm'] 時所有底色都是暖白（範本庫相容）", () => {
  for (const hex of seeds(60)) {
    for (const p of recommend(hex, { bgFamilies: ['warm'], extendedTypes: false })) {
      assert.equal(family(p.colors.background.hex), 'warm');
    }
  }
});

test('投影模式：底色 L ≥ 0.95，大面積 C ≤ 0.12', () => {
  for (const hex of seeds(100)) {
    for (const p of recommend(hex, { mode: 'teacher', scene: 'slides', projection: true })) {
      assert.ok(hexToOklch(p.colors.background.hex)[0] >= 0.95, `${hex} 底色不夠亮`);
      assert.ok(p.colors.background.oklch[1] <= 0.12);
      assert.ok(p.colors.secondary.oklch[1] <= 0.12);
    }
  }
});
