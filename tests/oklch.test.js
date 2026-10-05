import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToOklch, hexToRgb, rgbToHex, normalizeHex, isHex, roundOklch, hueDiff, toOklchString, toRgbString, toHslString } from '../src/color/oklch.js';
import { oklchToHex } from '../src/color/gamut.js';
import { createRng } from '../src/color/harmony.js';

const maxChannelDiff = (a, b) => Math.max(...hexToRgb(a).map((v, i) => Math.abs(v - hexToRgb(b)[i])));

test('sRGB → OKLCH → sRGB 往返誤差 ≤ 1/255（格點 4913 色）', () => {
  let worst = 0;
  for (let r = 0; r <= 255; r += 15) for (let g = 0; g <= 255; g += 15) for (let b = 0; b <= 255; b += 15) {
    const hex = rgbToHex([r, g, b]);
    worst = Math.max(worst, maxChannelDiff(hex, oklchToHex(hexToOklch(hex))));
  }
  assert.ok(worst <= 1, `最大誤差 ${worst}/255`);
});

test('sRGB → OKLCH → sRGB 往返誤差 ≤ 1/255（隨機 5000 色）', () => {
  const rng = createRng(1);
  for (let i = 0; i < 5000; i++) {
    const hex = rgbToHex([0, 0, 0].map(() => Math.floor(rng() * 256)));
    assert.ok(maxChannelDiff(hex, oklchToHex(hexToOklch(hex))) <= 1, hex);
  }
});

test('已知值：白、黑、純紅', () => {
  const [Lw, Cw] = hexToOklch('#FFFFFF');
  assert.ok(Math.abs(Lw - 1) < 1e-4 && Cw < 1e-4);
  const [Lk, Ck] = hexToOklch('#000000');
  assert.ok(Lk < 1e-6 && Ck < 1e-6);
  const [L, C, H] = hexToOklch('#FF0000'); // 公開參考值約 oklch(0.628 0.258 29.2)
  assert.ok(Math.abs(L - 0.628) < 0.001 && Math.abs(C - 0.258) < 0.001 && Math.abs(H - 29.2) < 0.2);
});

test('HEX 解析與正規化', () => {
  assert.equal(normalizeHex('#abc'), '#AABBCC');
  assert.equal(normalizeHex('78a5ce'), '#78A5CE');
  assert.ok(isHex('#78A5CE') && !isHex('#GGGGGG') && !isHex('12345'));
  assert.throws(() => hexToRgb('不是色碼'));
});

test('roundOklch 位數符合 SPEC 3.1（L、C 3 位，H 1 位）', () => {
  assert.deepEqual(roundOklch([0.70512, 0.07849, 246.649]), [0.705, 0.078, 246.6]);
});

test('hueDiff 處理 0°／360° 交界', () => {
  assert.equal(hueDiff(350, 10), 20);
  assert.equal(hueDiff(0, 180), 180);
});

test('輸出格式：oklch()、RGB、HSL', () => {
  assert.equal(toOklchString([0.705, 0.078, 246.6]), 'oklch(70.5% 0.078 246.6)');
  assert.equal(toRgbString('#78A5CE'), 'rgb(120, 165, 206)');
  assert.equal(toHslString('#FF0000'), 'hsl(0, 100%, 50%)');
});
