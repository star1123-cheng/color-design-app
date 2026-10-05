// 階段 3：色弱矩陣與灰階列印檢查（SPEC 4.5 第 2、3 點）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { section } from './spec-reader.js';
import {
  CVD_MATRICES, CVD_TYPES, simulateCvd, toGrayHex, grayL, checkGrayscale, checkCvdPair, checkCvd, cvdWarning,
  simulateColors, GRAYSCALE_MIN_DIFF, CVD_MIN_L_DIFF, CVD_MIN_HUE_DIFF,
} from '../src/color/cvd.js';
import { hexToOklch, isHex } from '../src/color/oklch.js';
import { oklchToHex } from '../src/color/gamut.js';
import { createRng } from '../src/color/harmony.js';

const s45 = section('4.5');

test('門檻等於 SPEC 4.5：灰階 L 差 0.12、色弱 L 差 0.10 或色相差 30°', () => {
  const gray = /轉灰階後 L 差 ≥ ([\d.]+)/.exec(s45);
  const cvd = /L 差 ≥ ([\d.]+) 或模擬後色相差 ≥ (\d+)°/.exec(s45);
  assert.ok(gray && cvd, 'SPEC 4.5 找不到門檻');
  assert.equal(GRAYSCALE_MIN_DIFF, Number(gray[1]));
  assert.equal(CVD_MIN_L_DIFF, Number(cvd[1]));
  assert.equal(CVD_MIN_HUE_DIFF, Number(cvd[2]));
});

test('三種色弱矩陣：3×3，每列總和為 1（白色與灰色模擬後不變）', () => {
  assert.deepEqual(CVD_TYPES, ['protan', 'deutan', 'tritan']);
  for (const t of CVD_TYPES) {
    const m = CVD_MATRICES[t];
    assert.equal(m.length, 3);
    for (const row of m) {
      assert.equal(row.length, 3);
      assert.ok(Math.abs(row.reduce((a, v) => a + v, 0) - 1) < 1e-5, `${t} 列總和`);
    }
    for (const g of ['#FFFFFF', '#808080', '#000000', '#3A3A3A']) assert.equal(simulateCvd(g, t), g, `${t} ${g}`);
  }
});

test('紅色在紅色弱、綠色弱模擬下變成黃褐色、且紅色弱看起來更暗；藍色弱看紅色幾乎不變', () => {
  const red = hexToOklch('#FF0000');
  for (const t of ['protan', 'deutan']) {
    const [, C, H] = hexToOklch(simulateCvd('#FF0000', t));
    assert.ok(C > 0.05 && H > 70 && H < 115, `${t} 色相 ${H.toFixed(1)}`);
  }
  assert.ok(hexToOklch(simulateCvd('#FF0000', 'protan'))[0] < red[0] - 0.1, '紅色弱看紅色較暗');
  const tri = hexToOklch(simulateCvd('#FF0000', 'tritan'));
  assert.ok(Math.abs(tri[0] - red[0]) < 0.03 && Math.abs(tri[2] - red[2]) < 5);
});

test('隨機 500 色：模擬結果都是合法的大寫 6 碼 HEX', () => {
  const rng = createRng(3);
  for (let i = 0; i < 500; i++) {
    const hex = '#' + Math.floor(rng() * 0x1000000).toString(16).padStart(6, '0').toUpperCase();
    for (const t of CVD_TYPES) assert.match(simulateCvd(hex, t), /^#[0-9A-F]{6}$/);
  }
  assert.throws(() => simulateCvd('#123456', 'xyz'));
});

test('灰階：已知答案（依相對亮度）', () => {
  assert.equal(toGrayHex('#FF0000'), '#7F7F7F'); // 亮度 0.2126
  assert.equal(toGrayHex('#00FF00'), '#DCDCDC'); // 亮度 0.7152
  assert.equal(toGrayHex('#0000FF'), '#4C4C4C'); // 亮度 0.0722
  assert.equal(toGrayHex('#808080'), '#808080');
  // 灰色的 OKLCH L 與 grayL 一致
  for (const hex of ['#FF0000', '#78A5CE', '#3B5C73', '#F5F1EA']) {
    assert.ok(Math.abs(hexToOklch(toGrayHex(hex))[0] - grayL(hex)) < 0.005, hex);
  }
});

test('灰階列印檢查：亮度相同的兩色不通過，明暗差大的通過', () => {
  assert.equal(checkGrayscale('#FF0000', '#7F7F7F').ok, false); // 紅色和它自己的灰
  const light = oklchToHex([0.85, 0.08, 240]), dark = oklchToHex([0.4, 0.08, 240]);
  const r = checkGrayscale(light, dark);
  assert.ok(r.ok && r.diff > 0.4);
  // 門檻邊界：差 0.12 以上才通過
  const a = oklchToHex([0.7, 0, 0]);
  const pass = oklchToHex([0.7 - 0.13, 0, 0]), fail = oklchToHex([0.7 - 0.11, 0, 0]);
  assert.equal(checkGrayscale(a, pass).ok, true);
  assert.equal(checkGrayscale(a, fail).ok, false);
});

test('色弱檢查：同明度的紅與綠，紅色弱、綠色弱分不清，藍色弱分得清', () => {
  const red = oklchToHex([0.6, 0.12, 30]), green = oklchToHex([0.6, 0.12, 140]);
  assert.deepEqual(checkCvd(red, green), { protan: false, deutan: false, tritan: true });
  assert.match(cvdWarning(checkCvd(red, green)), /紅色弱、綠色弱/);
});

test('色弱檢查：同明度的藍與青綠，藍色弱分不清', () => {
  const blue = oklchToHex([0.6, 0.12, 250]), teal = oklchToHex([0.6, 0.12, 170]);
  assert.equal(checkCvdPair(blue, teal, 'tritan').ok, false);
});

test('色弱檢查：明暗差大（L 差 ≥ 0.10）時三種都通過，沒有警告', () => {
  const light = oklchToHex([0.85, 0.08, 240]), dark = oklchToHex([0.4, 0.08, 240]);
  const cvd = checkCvd(light, dark);
  assert.deepEqual(cvd, { protan: true, deutan: true, tritan: true });
  assert.equal(cvdWarning(cvd), null);
  for (const t of CVD_TYPES) assert.ok(checkCvdPair(light, dark, t).lDiff >= 0.1);
});

test('色弱檢查（假設）：接近灰色時色相不算數，只看明度', () => {
  // 兩個幾乎無彩的顏色，色相差很大但看起來都是灰
  const a = oklchToHex([0.6, 0.01, 30]), b = oklchToHex([0.6, 0.01, 210]);
  for (const t of CVD_TYPES) assert.equal(checkCvdPair(a, b, t).ok, false, t);
});

test('simulateColors：五個角色都轉換、none 原樣回傳', () => {
  const colors = Object.fromEntries(['primary', 'secondary', 'background', 'text', 'accent']
    .map((r, i) => [r, { hex: ['#78A5CE', '#D9C9B1', '#F5F1EA', '#342C25', '#E36F4F'][i] }]));
  assert.equal(simulateColors(colors, 'none'), colors);
  for (const type of ['gray', ...CVD_TYPES]) {
    const out = simulateColors(colors, type);
    assert.deepEqual(Object.keys(out), Object.keys(colors));
    for (const c of Object.values(out)) assert.ok(isHex(c.hex) && c.oklch.length === 3);
  }
  const gray = simulateColors(colors, 'gray');
  for (const c of Object.values(gray)) assert.ok(c.oklch[1] < 0.001, '灰階沒有彩度');
});
