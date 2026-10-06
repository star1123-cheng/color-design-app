// 2026-10-07 使用者新增：同時選用多個漸層（每個用途一個），預覽、匯出、複製給 AI 與收藏都要帶上全部
// 2026-10-08 使用者決定：用途細到每個元件（與元件配色相同）；舊版的大用途讀入時換成元件
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../src/color/palette.js';
import { gradientList, pickGradients, gradientTargetsFor, GRADIENT_TARGETS, isGradientTarget } from '../src/color/gradient.js';
import { PARTS, partsFor } from '../src/data/parts.js';
import { hexList, cssVariables, slidesThemeText, selectedGradients, selectedGradient } from '../src/export/formats.js';
import { toYaml, toFullPrompt } from '../src/export/ai-prompt.js';
import {
  createState, gradientSelections, gradientAt, toggleGradient, removeGradient,
  setGradientTarget, setGradientDir, paletteForFavorite, applyFavorite,
} from '../src/state.js';
import { addFavorite, loadFavorites } from '../src/data/favorites.js';
import { validatePalette } from '../src/data/schema.js';

const memStorage = () => {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};

/** 背景用柔和同色（上到下）＋查看詳情按鈕用亮點漸層（斜角） */
function twoGradients() {
  let st = setGradientTarget(createState(), 'background');
  st = setGradientDir(st, 'v');
  st = toggleGradient(st, 'soft');
  st = setGradientTarget(st, 'button');
  st = setGradientDir(st, 'diag');
  return toggleGradient(st, 'accent');
}

test('狀態：不同用途可以各選一個漸層，互不影響', () => {
  const st = twoGradients();
  assert.deepEqual(gradientSelections(st), [
    { key: 'soft', target: 'background', dir: 'v' },
    { key: 'accent', target: 'button', dir: 'diag' },
  ]);
});

test('狀態：同一用途再選別的漸層會取代；再按一次同一個會取消', () => {
  let st = toggleGradient(twoGradients(), 'main'); // 正在設定 button
  assert.equal(gradientAt(st).key, 'main');
  assert.equal(gradientSelections(st).length, 2);
  st = toggleGradient(st, 'main');
  assert.deepEqual(gradientSelections(st).map((g) => g.target), ['background']);
  assert.equal(toggleGradient(st, 'nope'), st, '不認得的漸層不變');
});

test('狀態：切換用途時方向跟著那個用途；改方向只影響正在設定的用途', () => {
  let st = setGradientTarget(twoGradients(), 'background');
  assert.equal(st.gradientDir, 'v');
  st = setGradientDir(st, 'radial');
  assert.deepEqual(gradientSelections(st).map((g) => g.dir), ['radial', 'diag']);
  assert.equal(setGradientTarget(st, 'xx'), st);
  assert.equal(setGradientDir(st, 'xx'), st);
});

test('狀態：取消某個用途的漸層', () => {
  const st = removeGradient(twoGradients(), 'background');
  assert.deepEqual(gradientSelections(st).map((g) => g.key), ['accent']);
});

test('gradientList：接受舊格式單一物件、去掉不正確項目、同元件以後面為準', () => {
  assert.deepEqual(gradientList(null), []);
  assert.deepEqual(gradientList({ key: 'main', target: 'decoMid', dir: 'h' }), [{ key: 'main', target: 'decoMid', dir: 'h' }]);
  assert.deepEqual(gradientList([
    { key: 'main', target: 'qno', dir: 'v' }, { key: 'x', target: 'title', dir: 'h' },
    { key: 'soft', target: 'toString', dir: 'h' }, { key: 'soft', target: 'ring', dir: 'h' }, { key: 'deep', target: 'qno', dir: 'bad' },
  ]), [{ key: 'deep', target: 'qno', dir: 'diag' }]);
});

test('用途：與元件配色相同的元件（框線類除外），選單依預覽類型列出', () => {
  assert.deepEqual(Object.keys(GRADIENT_TARGETS), Object.keys(PARTS).filter((k) => PARTS[k].kind !== 'border'));
  for (const type of ['slides', 'webpage', 'worksheet']) {
    assert.deepEqual(gradientTargetsFor(type), partsFor(type).filter((k) => PARTS[k].kind !== 'border'), type);
  }
  assert.deepEqual(gradientTargetsFor('slides'), ['background', 'title', 'kicker', 'body', 'pageNo', 'decoBig', 'decoMid', 'decoDot']);
});

test('舊版大用途：橫幅換成標題、裝飾換成大圓與裝飾大圓，整頁背景與按鈕沿用', () => {
  assert.deepEqual(gradientList([
    { key: 'main', target: 'hero', dir: 'h' }, { key: 'deep', target: 'deco', dir: 'v' },
    { key: 'soft', target: 'background', dir: 'diag' }, { key: 'accent', target: 'button', dir: 'radial' },
  ]), [
    { key: 'soft', target: 'background', dir: 'diag' }, { key: 'main', target: 'title', dir: 'h' },
    { key: 'deep', target: 'decoBig', dir: 'v' }, { key: 'accent', target: 'button', dir: 'radial' },
    { key: 'deep', target: 'blob', dir: 'v' },
  ]);
  assert.ok(isGradientTarget('hero') && isGradientTarget('deco') && isGradientTarget('card1'));
  assert.ok(!isGradientTarget('ring') && !isGradientTarget('toString') && !isGradientTarget(null));
  // 舊收藏套用後也是換好的元件
  const st = applyFavorite(createState(), { gradient: { key: 'main', target: 'hero', dir: 'diag' } });
  assert.deepEqual(gradientSelections(st), [{ key: 'main', target: 'title', dir: 'diag' }]);
});

test('匯出：多個漸層全部附上；單一漸層時與舊版相同', () => {
  const [p] = recommend('#78A5CE', { mode: 'teacher', scene: 'slides' });
  const sels = gradientSelections(twoGradients());
  const gs = selectedGradients(p, sels);
  assert.equal(gs.length, 2);
  for (const make of [hexList, slidesThemeText]) {
    const t = make(p, gs);
    assert.ok(t.includes('柔和同色，用在背景') && t.includes('亮點漸層，用在查看詳情按鈕'), make.name);
  }
  const css = cssVariables(p, gs);
  assert.ok(css.includes('--gradient-soft:') && css.includes('--gradient-accent:'));
  // 同一種漸層用在兩個元件：變數名稱加上元件，避免重複
  const dup = selectedGradients(p, [{ key: 'main', target: 'title', dir: 'diag' }, { key: 'main', target: 'decoBig', dir: 'h' }]);
  const css2 = cssVariables(p, dup);
  assert.ok(css2.includes('--gradient-main-title:') && css2.includes('--gradient-main-deco-big:'));
  // 單一漸層：傳陣列與傳單一物件結果相同
  const one = selectedGradient(p, sels[0]);
  for (const make of [hexList, cssVariables, slidesThemeText, toYaml, toFullPrompt]) {
    assert.equal(make(p, [one]), make(p, one), make.name);
  }
  assert.equal(hexList(p, []), hexList(p));
});

test('複製給 AI：多個漸層輸出 gradients 清單與每個位置的規則', () => {
  const [p] = recommend('#78A5CE', { mode: 'teacher', scene: 'slides' });
  const gs = selectedGradients(p, gradientSelections(twoGradients()));
  const y = toYaml(p, gs);
  assert.match(y, /\ngradients:\n {2}- name: "柔和同色"\n {4}apply_to: "背景"\n {4}direction: "由上到下"\n {4}stops:\n {6}- "#/);
  assert.match(y, /\n {2}- name: "亮點漸層"\n {4}apply_to: "查看詳情按鈕"/);
  assert.ok(!/\ngradient:\n/.test(y));
  assert.ok(!y.includes('\t'));
  const full = toFullPrompt(p, gs);
  assert.ok(full.includes('漸層只用在 gradients 列出的 2 個位置'));
  assert.ok(full.includes('  - 背景：柔和同色') && full.includes('  - 查看詳情按鈕：亮點漸層'));
});

test('預覽用：pickGradients 依用途順序算出全部', () => {
  const [p] = recommend('#E07A5F');
  const gs = pickGradients(p.colors, gradientSelections(twoGradients()));
  assert.deepEqual(gs.map((g) => g.target), ['background', 'button']);
  assert.ok(gs.every((g) => g.css.includes('gradient(')));
});

test('收藏：多個漸層存成陣列、讀回還原；只有一個時仍存單一物件', () => {
  const [p] = recommend('#78A5CE');
  const s = memStorage();
  assert.equal(addFavorite(paletteForFavorite(p, twoGradients()), s).ok, true);
  const [saved] = loadFavorites(s).palettes;
  assert.ok(Array.isArray(saved.gradient));
  assert.equal(saved.gradient.length, 2);
  assert.deepEqual(gradientSelections(applyFavorite(createState(), saved)), gradientSelections(twoGradients()));
  // 拿掉一個 → 更新同一筆，並存回單一物件格式
  const r = addFavorite(paletteForFavorite(p, removeGradient(twoGradients(), 'button')), s);
  assert.match(r.message, /更新/);
  const [again] = loadFavorites(s).palettes;
  assert.deepEqual(again.gradient, { key: 'soft', target: 'background', dir: 'v' });
});

test('驗證：gradient 陣列每個用途最多一個，且不能是空陣列', () => {
  const [p] = recommend('#78A5CE');
  const a = { key: 'main', target: 'hero', dir: 'diag' };
  const b = { key: 'soft', target: 'background', dir: 'v' };
  assert.equal(validatePalette({ ...p, gradient: [a, b] }).valid, true);
  for (const bad of [[], [a, { ...a, key: 'deep' }], [a, { key: 'x', target: 'deco', dir: 'h' }], [a, null]]) {
    assert.equal(validatePalette({ ...p, gradient: bad }).valid, false, JSON.stringify(bad));
  }
});
