// 程式常數與 SPEC.md 一致性測試。
// 預期值一律由 tests/spec-reader.js 從 SPEC.md 原文解析，不從 src 複製（避免循環驗證）。
// 任何一方改了數值而另一方沒跟著改，這裡就會失敗；修改規則時必須同時更新 SPEC 與 docs/rules-changelog.md。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { section, row, range, le, ge, ratio, hueWindows } from './spec-reader.js';
import { CONTRAST } from '../src/color/contrast.js';
import { SCENES, PROJECTION_MIN_CONTRAST, minTextContrast } from '../src/data/presets.js';
import { RANGES, STYLE_PREFS, INSUFFICIENT_STYLES, checkStyle } from '../src/color/rules.js';

const s42 = section('4.2');
const s43 = section('4.3');
const s44 = section('4.4');
const s45 = section('4.5');
const s46 = section('4.6');
const s47 = section('4.7');

// ---------- SPEC 4.3、4.5、4.7：對比門檻 ----------

const spec43 = {
  text: ratio(row(s43, '一般文字（字色 on 底色）')[1]),
  largeText: ratio(row(s43, '大字（≥ 24 px 或 ≥ 18.66 px 粗體）')[1]),
  projectionText: ratio(row(s43, '老師模式「投影模式」正文')[1]),
  graphic: ratio(row(s43, '圖形元件（按鈕邊框、圖表線條）')[1]),
};

test('SPEC 4.3 解析結果合理（防止解析器本身出錯）', () => {
  assert.deepEqual(spec43, { text: 4.5, largeText: 3, projectionText: 7, graphic: 3 });
});

test('CONTRAST 等於 SPEC 4.3：字色 4.5、大字 3、投影 7、圖形元件 3', () => {
  assert.deepEqual(CONTRAST, spec43);
});

test('投影模式正文門檻等於 SPEC 4.5 第 1 點', () => {
  const m = /\*\*投影模式\*\*：正文 ([\d.]+):1/.exec(s45);
  assert.ok(m, 'SPEC 4.5 找不到投影模式正文門檻');
  assert.equal(PROJECTION_MIN_CONTRAST, Number(m[1]));
  assert.equal(minTextContrast('slides', true), Number(m[1]));
});

test('場景門檻等於 SPEC 4.7：上課簡報、學習單、班級網頁 4.5，海報 7', () => {
  // SPEC 4.7 表格沒有對比欄；未註明者採 4.3「一般文字」，備註「對比度採投影標準」者採 4.3「投影模式」
  const scenes = { slides: '上課簡報', worksheet: '學習單', webpage: '班級網頁', poster: '公布欄海報' };
  for (const [key, label] of Object.entries(scenes)) {
    const note = row(s47, label)[5];
    const expected = note.includes('對比度採投影標準') ? spec43.projectionText : spec43.text;
    assert.equal(SCENES[key].minContrast, expected, key);
  }
  assert.equal(SCENES.poster.minContrast, 7);
  assert.equal(SCENES.slides.minContrast, 4.5);
});

// ---------- SPEC 4.2：範圍表 ----------

const secondaryFromSpec = {
  冷暖對比型: (() => { const r = row(s42, '輔色（冷暖對比型，預設）'); return { L: range(r[1]), C: range(r[2]), dH: range(r[3]) }; })(),
  深淺對比型: (() => { const r = row(s42, '輔色（深淺對比型）'); return { dLmin: ge(r[1]), C: range(r[2]), dH: range(r[3]) }; })(),
  同色系型: (() => { const r = row(s42, '輔色（同色系型）'); return { dL: range(r[1]), C: range(r[2]), dH: range(r[3]) }; })(),
  中性輔色型: (() => { const r = row(s42, '輔色（中性輔色型）'); return { L: range(r[1]), C: [0, le(r[2])] }; })(),
};
const backgroundFromSpec = {
  暖底: (() => { const r = row(s42, '底色（暖）'); return { L: range(r[1]), C: range(r[2]), H: range(r[3]) }; })(),
  冷底: (() => { const r = row(s42, '底色（冷）'); return { L: range(r[1]), C: [0, le(r[2])], H: range(r[3]) }; })(),
  中性底: (() => { const r = row(s42, '底色（中性）'); return { L: range(r[1]), C: [0, le(r[2])] }; })(),
};
const withoutName = ({ name, ...rest }) => rest;

test('RANGES 主色、點綴色等於 SPEC 4.2', () => {
  const p = row(s42, '主色');
  assert.deepEqual(RANGES.primary, { L: range(p[1]), C: range(p[2]) });
  const a = row(s42, '點綴色');
  assert.deepEqual(RANGES.accent, { L: range(a[1]), C: range(a[2]) });
});

test('RANGES 輔色四型等於 SPEC 4.2', () => {
  assert.equal(RANGES.secondary.length, Object.keys(secondaryFromSpec).length);
  for (const s of RANGES.secondary) {
    assert.ok(secondaryFromSpec[s.name], `SPEC 沒有「${s.name}」`);
    assert.deepEqual(withoutName(s), secondaryFromSpec[s.name], s.name);
  }
});

test('RANGES 底色三型等於 SPEC 4.2', () => {
  assert.equal(RANGES.background.length, Object.keys(backgroundFromSpec).length);
  for (const b of RANGES.background) {
    assert.ok(backgroundFromSpec[b.name], `SPEC 沒有「${b.name}」`);
    assert.deepEqual(withoutName(b), backgroundFromSpec[b.name], b.name);
  }
});

test('RANGES 字色等於 SPEC 4.2', () => {
  const r = row(s42, '字色');
  const cool = /冷：(\d+)–(\d+)°/.exec(r[3]);
  const warm = /暖：(\d+)–(\d+)°/.exec(r[3]);
  const neutral = /C ≤ ([\d.]+) 視為中性/.exec(r[3]);
  assert.ok(cool && warm && neutral, 'SPEC 4.2 字色 H 欄格式無法解析');
  assert.deepEqual(RANGES.text, {
    L: range(r[1]),
    Cmax: le(r[2]),
    H: [[Number(cool[1]), Number(cool[2])], [Number(warm[1]), Number(warm[2])]],
    neutralC: Number(neutral[1]),
  });
});

test('RANGES 大面積色彩度建議等於 SPEC 4.2', () => {
  const m = /大面積色.*彩度 C 建議 ≤ ([\d.]+)/.exec(s42);
  assert.ok(m);
  assert.equal(RANGES.largeAreaCmax, Number(m[1]));
});

// ---------- SPEC 4.4：漸層 ----------

test('RANGES 漸層兩型等於 SPEC 4.4', () => {
  const span = /色相跨度（彩色部分）都 ≤ (\d+)°/.exec(s44);
  const full = /\*\*全幅型\*\*.*?淺端 L ≥ ([\d.]+)，深端 L ([\d.]+)–([\d.]+)，(.+)/.exec(s44);
  const light = /\*\*淺色型\*\*.*?淺端 L ≥ ([\d.]+)，深端 L ([\d.]+)–([\d.]+)，(.+)/.exec(s44);
  assert.ok(span && full && light, 'SPEC 4.4 格式無法解析');
  const peak = (text) => (text.includes('最深階彩度最高') ? 'darkest' : text.includes('中段彩度最高') ? 'middle' : null);
  const expected = [
    { name: '全幅型', hueSpan: Number(span[1]), lightMin: Number(full[1]), dark: [Number(full[2]), Number(full[3])], peak: peak(full[4]) },
    { name: '淺色型', hueSpan: Number(span[1]), lightMin: Number(light[1]), dark: [Number(light[2]), Number(light[3])], peak: peak(light[4]) },
  ];
  assert.deepEqual(RANGES.gradient, expected);
});

// ---------- SPEC 4.6：風格偏好 ----------

test('STYLE_PREFS 數值等於 SPEC 4.6（療癒、清新、森系、商務）', () => {
  for (const style of ['療癒', '清新', '森系']) {
    const r = row(s46, style);
    assert.deepEqual(STYLE_PREFS[style].H, hueWindows(r[1]), `${style} H`);
    assert.deepEqual(STYLE_PREFS[style].C, range(r[2]), `${style} C`);
  }
  const biz = row(s46, '商務')[3];
  const dark = /L ≤ ([\d.]+)/.exec(biz);
  const avg = /平均 C ≤ ([\d.]+)/.exec(biz);
  assert.ok(dark && avg, 'SPEC 4.6 商務欄位格式無法解析');
  assert.equal(STYLE_PREFS.商務.darkLmax, Number(dark[1]));
  assert.equal(STYLE_PREFS.商務.avgCmax, Number(avg[1]));
});

test('SPEC 4.6 樣本不足的風格（復古、夜間）不寫入引擎', () => {
  for (const style of ['復古', '夜間']) {
    assert.ok(row(s46, style)[1].includes('樣本不足'), `SPEC 4.6 ${style} 未標示樣本不足`);
    assert.equal(STYLE_PREFS[style], undefined, style);
    assert.ok(INSUFFICIENT_STYLES.includes(style), style);
  }
  assert.deepEqual(Object.keys(STYLE_PREFS).sort(), ['商務', '森系', '清新', '療癒'].sort());
});

test('風格邊界：清新主色 C 等於上限通過、超過 0.001 不通過', () => {
  const [lo, hi] = range(row(s46, '清新')[2]); // SPEC 4.6：0.025–0.08
  const H = 220;
  const at = (C) => checkStyle('清新', [[0.75, C, H]], [0.75, C, H]);
  assert.equal(at(hi), true);
  assert.equal(at(Math.round((hi + 0.001) * 1000) / 1000), false);
  assert.equal(at(lo), true);
  assert.equal(at(Math.round((lo - 0.001) * 1000) / 1000), false);
});

test('風格邊界：清新主色 H 在 180–255° 之外不通過', () => {
  const [h0, h1] = range(row(s46, '清新')[1]); // SPEC 4.6：180–255°
  const at = (H) => checkStyle('清新', [[0.75, 0.05, H]], [0.75, 0.05, H]);
  assert.equal(at(h0), true);
  assert.equal(at(h1), true);
  assert.equal(at(h0 - 1), false);
  assert.equal(at(h1 + 1), false);
});
