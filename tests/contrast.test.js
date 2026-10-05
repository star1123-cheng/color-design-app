import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, relativeLuminance, bestTextOn, adjustForContrast } from '../src/color/contrast.js';
import { hexToOklch } from '../src/color/oklch.js';

const near = (actual, expected, tol = 0.01) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} ≠ ${expected}`);

test('黑對白 = 21:1，同色對同色 = 1:1', () => {
  near(contrastRatio('#000000', '#FFFFFF'), 21, 1e-9);
  near(contrastRatio('#78A5CE', '#78A5CE'), 1, 1e-9);
  near(contrastRatio('#FFFFFF', '#000000'), 21, 1e-9); // 順序不影響
});

test('已知答案（WCAG 2.x）', () => {
  near(contrastRatio('#777777', '#FFFFFF'), 4.48);
  near(contrastRatio('#767676', '#FFFFFF'), 4.54);
  near(contrastRatio('#0000FF', '#FFFFFF'), 8.59);
  near(contrastRatio('#FF0000', '#FFFFFF'), 4.0);
  near(contrastRatio('#008000', '#FFFFFF'), 5.14);
  near(contrastRatio('#FFFF00', '#000000'), 19.56);
});

test('相對亮度端點', () => {
  assert.equal(relativeLuminance('#000000'), 0);
  near(relativeLuminance('#FFFFFF'), 1, 1e-9);
});

test('按鈕字色自動選黑或白', () => {
  assert.equal(bestTextOn('#FFFFFF').hex, '#000000');
  assert.equal(bestTextOn('#1E2A3E').hex, '#FFFFFF');
});

test('adjustForContrast：只調 L，達標或標示失敗', () => {
  const start = hexToOklch('#9AA5B0');
  const r = adjustForContrast(start, '#F7F2EA', 4.5);
  assert.ok(r.ok && r.ratio >= 4.5);
  assert.equal(r.oklch[1], start[1]);
  assert.equal(r.oklch[2], start[2]);
  assert.ok(Math.abs(r.delta) <= 0.3);

  const impossible = adjustForContrast(start, '#F7F2EA', 4.5, 0.05);
  assert.equal(impossible.ok, false);
});
