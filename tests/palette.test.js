import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, softenPrimary } from '../src/color/palette.js';
import { checkPalette } from '../src/color/rules.js';
import { contrastRatio } from '../src/color/contrast.js';
import { createRng } from '../src/color/harmony.js';
import { validatePalette } from '../src/data/schema.js';
import { SCENE_KEYS } from '../src/data/presets.js';

const lchMap = (p) => Object.fromEntries(Object.entries(p.colors).map(([k, v]) => [k, v.oklch]));
const randomHex = (rng) => '#' + Math.floor(rng() * 0x1000000).toString(16).padStart(6, '0').toUpperCase();

test('隨機 1000 個種子色：≥ 95% 推薦組符合 4.2，100% 字色對底色 ≥ 4.5:1', () => {
  const rng = createRng(20261005);
  let total = 0, inRange = 0, textOk = 0;
  for (let i = 0; i < 1000; i++) {
    for (const p of recommend(randomHex(rng))) {
      total++;
      if (checkPalette(lchMap(p)).ok) inRange++;
      if (contrastRatio(p.colors.text.hex, p.colors.background.hex) >= 4.5) textOk++;
    }
  }
  assert.ok(inRange / total >= 0.95, `符合率 ${inRange}/${total}`);
  assert.equal(textOk, total, `字色達標 ${textOk}/${total}`);
});

test('每次輸出 3–5 組，且全部通過 validatePalette', () => {
  const list = recommend('#78A5CE');
  assert.ok(list.length >= 3 && list.length <= 5);
  for (const p of list) assert.deepEqual(validatePalette(p).errors, []);
});

test('固定種子可重現（id 以外完全相同）', () => {
  const strip = (l) => l.map(({ id, ...rest }) => rest);
  assert.deepEqual(strip(recommend('#78A5CE')), strip(recommend('#78A5CE')));
  assert.deepEqual(strip(recommend('#78A5CE', { seed: 7 })), strip(recommend('#78A5CE', { seed: 7 })));
});

test('選色超出範圍時產生柔化版，保留色相並提示', () => {
  const { oklch, softened } = softenPrimary([0.95, 0.3, 30]);
  assert.equal(softened, true);
  assert.equal(oklch[2], 30);
  const list = recommend('#FF0000');
  assert.ok(list[0].checks.warnings.some((w) => w.includes('柔化')));
});

test('投影模式：正文 ≥ 7:1、底色 L ≥ 0.95、字級放大', () => {
  for (const p of recommend('#E7688B', { scene: 'slides', projection: true })) {
    assert.ok(p.checks.contrast.textOnBackground >= 7);
    assert.ok(p.colors.background.oklch[0] >= 0.95);
    assert.equal(p.typography.title, 40);
  }
});

test('四個場景都能產生並帶入對應字級', () => {
  for (const scene of SCENE_KEYS) {
    const [p] = recommend('#6B9274', { scene });
    assert.equal(p.context.scene, scene);
    assert.deepEqual(validatePalette(p).errors, []);
  }
});

test('大眾模式：樣本不足的風格提示「規則建置中」', () => {
  const [p] = recommend('#B99275', { mode: 'public', style: '復古' });
  assert.equal(p.mode, 'public');
  assert.equal(p.context.style, '復古');
  assert.ok(p.checks.warnings.some((w) => w.includes('規則建置中')));
});
