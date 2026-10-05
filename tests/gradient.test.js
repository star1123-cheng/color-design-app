import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGradient } from '../src/color/gradient.js';
import { checkGradient } from '../src/color/rules.js';

test('全幅型與淺色型漸層：各色相都符合 4.4', () => {
  const fails = [];
  for (let h = 0; h < 360; h += 15) {
    for (const type of ['full', 'light']) {
      const g = makeGradient([0.65, 0.12, h], { type });
      assert.equal(g.length, 5);
      const r = checkGradient(g.map((c) => c.oklch));
      if (!r.ok) fails.push(`${type} H${h}`);
    }
  }
  assert.deepEqual(fails, []);
});

test('漸層由淺到深', () => {
  const g = makeGradient([0.6, 0.1, 240]);
  for (let i = 1; i < g.length; i++) assert.ok(g[i].oklch[0] < g[i - 1].oklch[0]);
});

import { gradientSuggestions, gradientCss, mixOklch } from '../src/color/gradient.js';
import { recommend } from '../src/color/palette.js';
import { contrastRatio } from '../src/color/contrast.js';
import { createState, adjustTypography, typographyScale, resetTypography } from '../src/state.js';

test('漸層建議：每種都有色碼、CSS，字色標示可用時每一段對比都達標', () => {
  for (const hex of ['#78A5CE', '#E07A5F', '#2F6B4F', '#F2C94C', '#7A5C99']) {
    const p = recommend(hex, { mode: 'teacher', scene: 'slides' })[0];
    const list = gradientSuggestions(p.colors, { min: 4.5 });
    assert.deepEqual(list.map((g) => g.key), ['soft', 'analog', 'main', 'accent', 'deep']);
    for (const g of list) {
      assert.ok(g.stops.length >= 3);
      for (const s of g.stops) assert.match(s.hex, /^#[0-9A-F]{6}$/);
      assert.ok(g.css.startsWith('linear-gradient(135deg, '));
      if (g.text.hex) for (const s of g.stops) assert.ok(contrastRatio(g.text.hex, s.hex) >= 4.5, `${hex} ${g.key}`);
    }
  }
});

test('漸層 CSS 語法與中間色', () => {
  assert.equal(gradientCss([{ hex: '#111111' }, { hex: '#222222' }, { hex: '#333333' }]),
    'linear-gradient(135deg, #111111 0%, #222222 50%, #333333 100%)');
  // 藍（H 250）到紅（H 20）走最短路徑，中間色相不會繞到綠色
  const mid = mixOklch([0.6, 0.12, 250], [0.6, 0.12, 20]).oklch[2];
  assert.ok(mid > 300 || mid < 20, `中間色相 ${mid}`);
});

test('字級微調會改變預覽倍率，回到建議字級後倍率為 1', () => {
  let s = createState();
  assert.deepEqual(typographyScale(s), { title: 1, body: 1 });
  s = adjustTypography(s, 'title', 4);
  assert.ok(typographyScale(s).title > 1);
  s = resetTypography(s);
  assert.deepEqual(typographyScale(s), { title: 1, body: 1 });
});
