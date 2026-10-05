// 階段 3：模式切換、老師模式（場景、投影、字級微調）、大眾模式（風格標籤）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { section, row } from './spec-reader.js';
import {
  createState, pickColor, setScene, setProjection, setStyle, adjustTypography,
  currentTypography, recommendOptions, withTypography,
} from '../src/state.js';
import { SCENES, SCENE_KEYS, STYLES, typographyLimits, clampTypography, layoutTips, typographyFor } from '../src/data/presets.js';
import { recommend, checkProjection, PROJECTION } from '../src/color/palette.js';
import { checkStyle, checkPalette, STYLE_PREFS, INSUFFICIENT_STYLES, within } from '../src/color/rules.js';
import { contrastRatio } from '../src/color/contrast.js';
import { validatePalette } from '../src/data/schema.js';
import { createRng } from '../src/color/harmony.js';
import { oklchToHex } from '../src/color/gamut.js';
import { checkGrayscale } from '../src/color/cvd.js';

const lchMap = (p) => Object.fromEntries(Object.entries(p.colors).map(([k, v]) => [k, v.oklch]));

// ---------- 功能整合（2026-10-05 起不分模式） ----------

test('整合：換場景、投影、風格都不會改變選色', () => {
  let s = pickColor(createState(), '#e36f4f');
  const { hex, base } = s;
  s = setStyle(setProjection(setScene(s, 'poster'), true), '療癒');
  assert.equal(s.hex, hex);
  assert.deepEqual(s.base, base);
  assert.equal(s.scene, 'poster');
  assert.equal(s.projection, true);
  assert.equal(s.style, '療癒');
});

test('整合：推薦同時套用場景、投影與風格', () => {
  const s = setStyle(setProjection(setScene(pickColor(createState(), '#E7688B'), 'slides'), true), '療癒');
  for (const p of recommend(s.hex, recommendOptions(s))) {
    assert.equal(p.context.scene, 'slides');
    assert.equal(p.context.style, '療癒');
    assert.equal(p.context.projection, true);
    assert.ok(checkProjection(p).ok);
    assert.ok(checkStyle('療癒', Object.values(p.colors).map((c) => c.oklch), p.colors.primary.oklch));
    assert.deepEqual(validatePalette(p).errors, []);
  }
});

test('明度滑桿：只改 L，不更換明度基準；新選色才更換', () => {
  const s = createState();
  const t = pickColor(s, '#5A86AE', { rebase: false });
  assert.deepEqual(t.base, s.base);
  assert.notDeepEqual(pickColor(s, '#5A86AE').base, s.base);
});

// ---------- 老師模式：四個場景、字級與版面建議 ----------

const s47 = section('4.7');
const SCENE_LABELS = { slides: '上課簡報', worksheet: '學習單', webpage: '班級網頁', poster: '公布欄海報' };

test('四個場景預設：字級等於 SPEC 4.7 表格，下限為 0.8 倍（四捨五入）', () => {
  assert.deepEqual(SCENE_KEYS, Object.keys(SCENE_LABELS));
  for (const [key, label] of Object.entries(SCENE_LABELS)) {
    const r = row(s47, label);
    assert.equal(SCENES[key].label, label);
    const lim = typographyLimits(key);
    assert.equal(lim.unit, r[1]);
    assert.equal(lim.title.default, Number(r[2]));
    assert.equal(lim.body.default, Number(r[3]));
    assert.equal(lim.title.min, Math.round(Number(r[2]) * 0.8));
    assert.equal(lim.body.min, Math.round(Number(r[3]) * 0.8));
  }
  // 投影模式以投影字級為預設（SPEC 4.7：標題 40、內文 24）
  assert.deepEqual([typographyLimits('slides', true).title.min, typographyLimits('slides', true).body.min], [32, 19]);
});

test('四個場景都有版面建議（每頁重點、行高、黑白列印、遠距離閱讀）', () => {
  for (const key of SCENE_KEYS) assert.ok(layoutTips(key).length >= 1, key);
  assert.ok(layoutTips('slides').some((t) => t.includes('最多 3 個重點')));
  assert.ok(layoutTips('webpage').some((t) => t.includes('行高建議 1.6')));
  assert.ok(layoutTips('worksheet').some((t) => t.includes('黑白')));
  assert.ok(layoutTips('poster').some((t) => t.includes('7:1')));
  assert.ok(layoutTips('slides', true).some((t) => t.includes('投影模式')));
});

test('字級微調：不得低於下限、也不超過上限（假設 2 倍）、取整數', () => {
  assert.deepEqual(clampTypography('slides', false, { title: 10, body: 3 }), { ...typographyFor('slides'), title: 29, body: 16 });
  assert.equal(clampTypography('worksheet', false, { body: 9.4 }).body, 10);
  assert.equal(clampTypography('worksheet', false, { body: 12.6 }).body, 13);
  assert.equal(clampTypography('slides', false, { title: 999 }).title, 72);
  assert.equal(clampTypography('slides', false, { title: 'abc' }).title, 36);
});

test('字級微調按鈕：一直往下按會停在下限；換場景或投影模式回到預設', () => {
  let s = setScene(createState(), 'worksheet');
  for (let i = 0; i < 20; i++) s = adjustTypography(s, 'body', -1);
  assert.equal(currentTypography(s).body, 10); // 12 × 0.8 = 9.6 → 10
  s = adjustTypography(s, 'body', 1);
  assert.equal(currentTypography(s).body, 11);
  assert.equal(currentTypography(setScene(s, 'slides')).body, 20);
  assert.equal(currentTypography(setProjection(s, true)).body, 12, '學習單沒有投影字級，維持 12');
});

test('字級微調會寫進配色資料（SPEC 3.1 typography），仍通過 validatePalette', () => {
  let s = setScene(createState(), 'slides');
  s = adjustTypography(s, 'title', 4);
  const p = withTypography(recommend(s.hex, recommendOptions(s))[0], s);
  assert.equal(p.typography.title, 40);
  assert.deepEqual(validatePalette(p).errors, []);
});

test('換場景：預覽改成對應版面；學習單預設開啟黑白列印檢查', () => {
  const s = createState();
  assert.equal(setScene(s, 'worksheet').previewType, 'worksheet');
  assert.equal(setScene(s, 'worksheet').simulate, 'gray');
  assert.equal(setScene(s, 'webpage').previewType, 'webpage');
  assert.equal(setScene(s, 'webpage').simulate, 'none');
  assert.equal(setScene(s, 'nope'), s);
});

// ---------- 老師模式：投影模式 ----------

test('投影模式：隨機 300 色全部通過 checkProjection（正文 7:1、底色 L ≥ 0.95、大面積 C ≤ 0.12）', () => {
  const rng = createRng(77);
  for (let i = 0; i < 300; i++) {
    const hex = '#' + Math.floor(rng() * 0x1000000).toString(16).padStart(6, '0');
    for (const p of recommend(hex, { mode: 'teacher', scene: SCENE_KEYS[i % 4], projection: true })) {
      const r = checkProjection(p);
      assert.ok(r.ok, `${hex} ${r.issues.join('、')}`);
      assert.ok(contrastRatio(p.colors.text.hex, p.colors.background.hex) >= 7);
    }
  }
});

test('checkProjection：不符合時列出原因', () => {
  const [p] = recommend('#78A5CE', { mode: 'teacher' });
  const bad = {
    ...p,
    colors: { ...p.colors, background: { hex: '#E8E0D0', oklch: [0.9, 0.02, 85] }, secondary: { ...p.colors.secondary, oklch: [0.7, 0.13, 30] } },
    checks: { ...p.checks, contrast: { ...p.checks.contrast, textOnBackground: 5 } },
  };
  const r = checkProjection(bad);
  assert.equal(r.ok, false);
  assert.equal(r.issues.length, 3);
  assert.equal(PROJECTION.bgLmin, 0.95);
});

// ---------- 推薦結果帶有灰階與色弱檢查 ----------

test('推薦結果：checks.cvd 為三個布林值；未通過時有警告；灰階 L 差與警告一致', () => {
  const rng = createRng(11);
  for (let i = 0; i < 200; i++) {
    const hex = '#' + Math.floor(rng() * 0x1000000).toString(16).padStart(6, '0');
    for (const p of recommend(hex, { mode: 'teacher' })) {
      const { cvd, warnings, grayscaleLDiff } = p.checks;
      for (const t of ['protan', 'deutan', 'tritan']) assert.equal(typeof cvd[t], 'boolean');
      const cvdFail = Object.values(cvd).includes(false);
      assert.equal(warnings.some((w) => w.includes('分不清主色與輔色')), cvdFail);
      const gray = checkGrayscale(p.colors.primary.hex, p.colors.secondary.hex);
      assert.equal(warnings.some((w) => w.includes('列印成黑白')), !gray.ok);
      assert.equal(grayscaleLDiff, Math.round(gray.diff * 1000) / 1000);
    }
  }
});

// ---------- 大眾模式：六個風格標籤 ----------

const s46 = section('4.6');

test('六個風格標籤；復古、夜間標示規則建置中（不可選）', () => {
  assert.deepEqual(STYLES.map((s) => s.key), ['清新', '療癒', '復古', '商務', '森系', '夜間']);
  for (const s of STYLES) {
    const specRow = row(s46, s.key);
    assert.equal(s.available, !specRow[1].includes('樣本不足'), s.key);
  }
  const st = createState();
  assert.equal(setStyle(st, '復古'), st, '不可選建置中的風格');
  assert.equal(setStyle(st, '療癒').style, '療癒');
  assert.equal(setStyle(setStyle(st, '療癒'), null).style, null);
});

/** 在風格色相範圍內（離邊界 3° 以上）隨機產生種子色 */
function seedsInStyle(style, n, rng) {
  const wins = STYLE_PREFS[style].H;
  const out = [];
  while (out.length < n) {
    const H = rng() * 360;
    if (!wins.some((w) => within(H, [w[0] + 3, w[1] - 3]) || (w[1] === 360 && H >= w[0] + 3) || (w[0] === 0 && H <= w[1] - 3))) continue;
    out.push(oklchToHex([0.5 + rng() * 0.3, 0.02 + rng() * 0.2, H]));
  }
  return out;
}

test('療癒、清新、森系：色相在範圍內的選色，推薦結果 100% 符合風格（主色色相與彩度）', () => {
  const rng = createRng(46);
  for (const style of ['療癒', '清新', '森系']) {
    for (const hex of seedsInStyle(style, 150, rng)) {
      for (const p of recommend(hex, { mode: 'public', style })) {
        const all = Object.values(p.colors).map((c) => c.oklch);
        assert.ok(checkStyle(style, all, p.colors.primary.oklch), `${style} ${hex} → ${p.colors.primary.oklch}`);
      }
    }
  }
});

test('商務：隨機 300 色，推薦結果 100% 符合（有 L ≤ 0.52 的深色、整組平均 C ≤ 0.05）', () => {
  const rng = createRng(52);
  for (let i = 0; i < 300; i++) {
    const hex = '#' + Math.floor(rng() * 0x1000000).toString(16).padStart(6, '0');
    for (const p of recommend(hex, { mode: 'public', style: '商務' })) {
      const all = Object.values(p.colors).map((c) => c.oklch);
      assert.ok(checkStyle('商務', all, p.colors.primary.oklch), `${hex} 平均 C ${(all.reduce((a, c) => a + c[1], 0) / 5).toFixed(3)}`);
    }
  }
});

test('風格推薦仍符合 4.2 範圍（≥ 95%）且字色 100% ≥ 4.5:1', () => {
  const rng = createRng(4206);
  let total = 0, inRange = 0;
  for (let i = 0; i < 400; i++) {
    const hex = '#' + Math.floor(rng() * 0x1000000).toString(16).padStart(6, '0');
    const style = ['清新', '療癒', '商務', '森系'][i % 4];
    for (const p of recommend(hex, { mode: 'public', style })) {
      total++;
      if (checkPalette(lchMap(p)).ok) inRange++;
      assert.ok(contrastRatio(p.colors.text.hex, p.colors.background.hex) >= 4.5);
      assert.deepEqual(validatePalette(p).errors, []);
    }
  }
  assert.ok(inRange / total >= 0.95, `${inRange}/${total}`);
});

test('選色不在風格色相範圍：保留使用者的色相，並提示', () => {
  const [p] = recommend('#3D7FC4', { mode: 'public', style: '森系' }); // 藍色選「森系」
  assert.ok(p.checks.warnings.some((w) => w.includes('不是「森系」常見的綠色系')));
  assert.ok(Math.abs(p.colors.primary.oklch[2] - 250) < 15, '色相仍是藍色');
});

test('風格與場景可以同時使用；沒選風格時不套用', () => {
  const [p] = recommend('#3D7FC4', { mode: 'teacher', scene: 'worksheet', style: '商務' });
  assert.equal(p.context.style, '商務');
  assert.equal(p.context.scene, 'worksheet');
  const [q] = recommend('#3D7FC4', { mode: 'teacher' });
  assert.equal(q.context.style, null);
  assert.ok(!q.checks.warnings.some((w) => w.includes('風格')));
  for (const s of INSUFFICIENT_STYLES) assert.ok(!STYLE_PREFS[s]);
});
