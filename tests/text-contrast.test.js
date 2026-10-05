// 字色對比度修正（SPEC 4.3）：需要修正時真的會修正；無法達標時要警告並回報 ok = false
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeText } from '../src/color/palette.js';
import { contrastRatio } from '../src/color/contrast.js';
import { quantize } from '../src/color/gamut.js';
import { hueDiff } from '../src/color/oklch.js';
import { section, row, ratio } from './spec-reader.js';

const s43 = section('4.3');
const MIN = ratio(row(s43, '一般文字（字色 on 底色）')[1]); // SPEC 4.3：4.5:1
const MAX_DELTA = Number(/最多調整到 L ± ([\d.]+)/.exec(s43)[1]); // SPEC 4.3：0.30
const COOL_PRIMARY = [0.7, 0.08, 246];                       // 冷色主色 → 字色 H 240°
const START = quantize([0.3, 0.035, 240]);                   // makeText 的起始字色

test('(a) 中灰底色：起始字色不達標，會調暗明度並達到門檻', () => {
  const bg = '#8A8A8A';
  assert.ok(contrastRatio(START.hex, bg) < MIN, '前提：起始字色在此底色上必須不達標，才能驗證修正');
  const t = makeText(COOL_PRIMARY, bg, MIN);
  assert.equal(t.ok, true);
  assert.equal(t.warning, null);
  assert.ok(t.ratio >= MIN, `對比度 ${t.ratio}`);
  assert.ok(contrastRatio(t.hex, bg) >= MIN);
  assert.ok(t.oklch[0] < START.oklch[0], '應往暗的方向調整');
  assert.ok(START.oklch[0] - t.oklch[0] <= MAX_DELTA + 0.005, '調整量不超過 SPEC 上限');
  assert.ok(hueDiff(t.oklch[2], 240) < 2, '只調 L，色相不變');
});

test('(a) 投影門檻 7:1：同樣會修正到達標', () => {
  const bg = '#B0B0B0';
  const projection = ratio(row(s43, '老師模式「投影模式」正文')[1]); // SPEC 4.3：7:1
  assert.ok(contrastRatio(START.hex, bg) < projection, '前提：起始字色不達標');
  const t = makeText(COOL_PRIMARY, bg, projection);
  assert.equal(t.ok, true);
  assert.ok(t.ratio >= projection);
});

test('(b) 底色無法達標：ok 為 false，並輸出警告', () => {
  const bg = '#595959'; // 連純黑對它都只有約 3:1
  assert.ok(contrastRatio('#000000', bg) < MIN, '前提：此底色在 L 調整範圍內不可能達標');
  const t = makeText(COOL_PRIMARY, bg, MIN);
  assert.equal(t.ok, false);
  assert.ok(t.ratio < MIN);
  assert.equal(typeof t.warning, 'string');
  assert.ok(t.warning.includes(`未達 ${MIN}:1`), t.warning);
});

test('一般底色：不需修正時保持起始字色、沒有警告', () => {
  const t = makeText(COOL_PRIMARY, '#F7F2E9', MIN);
  assert.equal(t.ok, true);
  assert.equal(t.warning, null);
  assert.equal(t.hex, START.hex);
});
