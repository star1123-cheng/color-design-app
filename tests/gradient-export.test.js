// 2026-10-06 使用者新增：點綴色取相近色、漸層可選用途與方向、選定的漸層放進匯出與「複製給 AI」
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../src/color/palette.js';
import { hueDiff } from '../src/color/oklch.js';
import { pickGradient, gradientCss, GRADIENT_TARGETS, GRADIENT_DIRS } from '../src/color/gradient.js';
import { hexList, rgbList, cssVariables, cssOklch, slidesThemeText, selectedGradient } from '../src/export/formats.js';
import { toYaml, toFullPrompt } from '../src/export/ai-prompt.js';
import { createState, gradientSelection } from '../src/state.js';

const HEXES = ['#78A5CE', '#E07A5F', '#2F6B4F', '#F2C94C', '#7A5C99', '#74AECF'];

test('點綴色：色相與主色相近（≤ 40°），仍在 SPEC 範圍且對底色 ≥ 3:1', () => {
  for (const hex of HEXES) {
    for (const p of recommend(hex, { mode: 'public', style: '清新' }).concat(recommend(hex))) {
      const [L, C, H] = p.colors.accent.oklch;
      assert.ok(hueDiff(H, p.colors.primary.oklch[2]) <= 40, `${hex} ${p.name} 色相差 ${hueDiff(H, p.colors.primary.oklch[2])}`);
      assert.ok(L >= 0.6 && L <= 0.78 && C >= 0.1 && C <= 0.14, `${hex} ${p.name} L${L} C${C}`);
      assert.ok(p.checks.contrast.accentOnBackground >= 3, `${hex} ${p.name}`);
    }
  }
});

test('點綴色 far 模式維持舊算法（範本庫用）', () => {
  const [near] = recommend('#78A5CE', { bgFamilies: ['warm'], extendedTypes: false });
  const [far] = recommend('#78A5CE', { bgFamilies: ['warm'], extendedTypes: false, accentHue: 'far' });
  assert.ok(hueDiff(far.colors.accent.oklch[2], far.colors.primary.oklch[2]) > hueDiff(near.colors.accent.oklch[2], near.colors.primary.oklch[2]));
});

test('漸層方向：四種方向都產生對應的 CSS', () => {
  const stops = [{ hex: '#111111' }, { hex: '#333333' }];
  assert.equal(gradientCss(stops, 'h'), 'linear-gradient(90deg, #111111 0%, #333333 100%)');
  assert.equal(gradientCss(stops, 'v'), 'linear-gradient(180deg, #111111 0%, #333333 100%)');
  assert.equal(gradientCss(stops, 'radial'), 'radial-gradient(circle at top left, #111111 0%, #333333 100%)');
  assert.equal(gradientCss(stops, 'xx'), 'linear-gradient(135deg, #111111 0%, #333333 100%)');
});

test('pickGradient：未選回傳 null；不認得的用途與方向改用預設', () => {
  const [p] = recommend('#78A5CE');
  assert.equal(pickGradient(p.colors, { key: null }), null);
  assert.equal(pickGradient(p.colors, { key: 'nope' }), null);
  const g = pickGradient(p.colors, { key: 'main', target: 'xx', dir: 'yy' });
  assert.equal(g.target, 'hero');
  assert.equal(g.dir, 'diag');
  for (const t of Object.keys(GRADIENT_TARGETS)) for (const d of Object.keys(GRADIENT_DIRS)) {
    const x = pickGradient(p.colors, { key: 'analog', target: t, dir: d });
    assert.equal(x.target, t);
    assert.equal(x.dir, d);
  }
});

test('狀態預設：沒有選漸層、用在橫幅、斜角', () => {
  assert.deepEqual(gradientSelection(createState()), { key: null, target: 'hero', dir: 'diag' });
});

test('匯出：沒選漸層時內容與舊版相同；選了之後每種格式都附上漸層', () => {
  const [p] = recommend('#78A5CE', { mode: 'teacher', scene: 'slides' });
  assert.equal(selectedGradient(p, { key: null }), null);
  assert.equal(hexList(p, null), hexList(p));
  assert.ok(!toYaml(p).includes('gradient:'));

  const g = selectedGradient(p, { key: 'soft', target: 'background', dir: 'v' });
  const hexes = g.stops.map((s) => s.hex);
  for (const make of [hexList, cssVariables, cssOklch, slidesThemeText]) {
    const out = make(p, g);
    assert.ok(hexes.every((h) => out.includes(h)), make.name);
    assert.ok(out.includes('整頁背景'), make.name);
  }
  assert.ok(rgbList(p, g).includes('漸層（柔和同色'));
  assert.ok(cssVariables(p, g).includes(`--gradient-soft: ${g.css};`));
  assert.ok(cssVariables(p, g).trimEnd().endsWith('}'));

  const y = toYaml(p, g);
  assert.match(y, /\ngradient:\n {2}name: "柔和同色"\n {2}apply_to: "整頁背景"\n {2}direction: "由上到下"\n {2}stops:\n/);
  for (const h of hexes) assert.ok(y.includes(`    - "${h}"`));
  assert.ok(!/\t/.test(y));
  const full = toFullPrompt(p, g);
  assert.ok(full.includes('漸層只用在「整頁背景」'));
  assert.ok(full.includes('gradient:'));
});
