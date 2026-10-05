import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampChroma, isInGamut, oklchToHex, maxChroma } from '../src/color/gamut.js';
import { createRng } from '../src/color/harmony.js';

const HEX = /^#[0-9A-F]{6}$/;

test('色域修正：保持 L 與 H，只降低 C', () => {
  const src = [0.7, 0.4, 150]; // 超出 sRGB
  assert.equal(isInGamut(src), false);
  const out = clampChroma(src);
  assert.equal(out[0], 0.7);
  assert.equal(out[2], 150);
  assert.ok(out[1] < 0.4 && isInGamut(out));
});

test('色域內的顏色不被修改', () => {
  assert.deepEqual(clampChroma([0.6, 0.05, 200]), [0.6, 0.05, 200]);
});

test('隨機 2000 個 OKLCH（含大量超出色域）都能轉成合法 HEX', () => {
  const rng = createRng(42);
  for (let i = 0; i < 2000; i++) {
    const lch = [rng() * 1.1 - 0.05, rng() * 0.5, rng() * 360];
    assert.match(oklchToHex(lch), HEX, JSON.stringify(lch));
  }
});

test('邊界：L ≤ 0 為黑、L ≥ 1 為白', () => {
  assert.equal(oklchToHex([0, 0.2, 30]), '#000000');
  assert.equal(oklchToHex([1, 0.2, 30]), '#FFFFFF');
});

test('maxChroma 回傳值在色域邊界上', () => {
  const c = maxChroma(0.65, 260);
  assert.ok(isInGamut([0.65, c, 260]));
  assert.equal(isInGamut([0.65, c + 0.01, 260]), false);
});
