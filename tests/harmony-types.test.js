// 輔色類型：除了強對比（冷暖、深淺），也要有相近色（同色系、中性輔色）增加和諧感
import test from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../src/color/palette.js';
import { hueDiff } from '../src/color/oklch.js';

function seeds(n) {
  let s = 2468;
  const out = [];
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out.push('#' + (s & 0xffffff).toString(16).padStart(6, '0').toUpperCase());
  }
  return out;
}
const typeOf = (p) => p.name.replace(/ \d+$/, '');

test('推薦 5 組，四種輔色類型各至少 1 組（含同色系型、中性輔色型）', () => {
  for (const hex of seeds(200)) {
    const r = recommend(hex, { mode: 'teacher', scene: 'slides' });
    assert.equal(r.length, 5, hex);
    assert.deepEqual([...new Set(r.map(typeOf))].sort(), ['中性輔色型', '冷暖對比型', '同色系型', '深淺對比型'].sort(), hex);
  }
});

test('extendedTypes: false 時只有舊版兩種對比類型（範本庫相容）', () => {
  for (const hex of seeds(50)) {
    const types = new Set(recommend(hex, { extendedTypes: false }).map(typeOf));
    assert.deepEqual([...types].sort(), ['冷暖對比型', '深淺對比型'].sort(), hex);
  }
});

test('同色系型：與主色色相差 ≤ 60°、明度差 ≤ 0.25（含量化容許）', () => {
  for (const hex of seeds(200)) {
    for (const p of recommend(hex).filter((x) => typeOf(x) === '同色系型')) {
      const [pl, , ph] = p.colors.primary.oklch;
      const [sl, sc, sh] = p.colors.secondary.oklch;
      assert.ok(Math.abs(pl - sl) <= 0.255, `${hex} L 差`);
      if (sc > 0.015) assert.ok(hueDiff(ph, sh) <= 62, `${hex} 色相差`);
    }
  }
});

test('中性輔色型：C ≤ 0.04、L 在 0.55–0.91（含量化容許）', () => {
  for (const hex of seeds(200)) {
    for (const p of recommend(hex).filter((x) => typeOf(x) === '中性輔色型')) {
      const [sl, sc] = p.colors.secondary.oklch;
      assert.ok(sc <= 0.042, `${hex} C=${sc}`);
      assert.ok(sl >= 0.545 && sl <= 0.915, `${hex} L=${sl}`);
    }
  }
});

test('商務風格加入新類型後，整組平均 C 仍 ≤ 0.05（含量化容許）', () => {
  for (const hex of seeds(100)) {
    for (const p of recommend(hex, { mode: 'public', style: '商務' })) {
      const cs = Object.values(p.colors).map((c) => c.oklch[1]);
      assert.ok(cs.reduce((a, b) => a + b, 0) / cs.length <= 0.052, `${hex} ${p.name}`);
    }
  }
});
