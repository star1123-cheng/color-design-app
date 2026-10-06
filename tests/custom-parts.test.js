// 元件配色（2026-10-06 使用者新增）：狀態、驗證、收藏、匯出
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recommend } from '../src/color/palette.js';
import { ROLES as SCHEMA_ROLES, validatePalette } from '../src/data/schema.js';
import { PARTS, PART_KEYS, ROLES, partsFor, isPartValue, isCustomMap, resolvePart, customEntries, partVar } from '../src/data/parts.js';
import { createState, setPartColor, resetCustom, paletteForFavorite, applyFavorite } from '../src/state.js';
import { addFavorite, loadFavorites } from '../src/data/favorites.js';
import { hexList, rgbList, cssVariables, cssOklch, slidesThemeText } from '../src/export/formats.js';
import { toYaml, toFullPrompt } from '../src/export/ai-prompt.js';

const [P] = recommend('#78A5CE');
const memStorage = () => {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};

test('parts.js 的角色清單與 schema.js 一致；每種預覽都有元件，且都在預覽程式裡標出來', () => {
  assert.deepEqual(ROLES, SCHEMA_ROLES);
  const src = readFileSync(new URL('../src/ui/preview.js', import.meta.url), 'utf8');
  for (const type of ['slides', 'webpage', 'worksheet']) assert.ok(partsFor(type).length >= 6, type);
  for (const k of PART_KEYS) {
    assert.ok(src.includes(`'data-part': '${k}'`) || src.includes(`'${k}')`), `preview.js 沒有標出 ${k}`);
    assert.ok(['page', 'text', 'fill', 'border', 'tint'].includes(PARTS[k].kind), k);
  }
});

test('值：角色名稱或大寫 HEX 才合法；resolvePart 取得色碼', () => {
  assert.ok(isPartValue('accent'));
  assert.ok(isPartValue('#12AB3C'));
  for (const bad of ['#12ab3c', '#FFF', 'red', '', null, 5]) assert.equal(isPartValue(bad), false, String(bad));
  assert.equal(resolvePart('primary', P.colors), P.colors.primary.hex);
  assert.equal(resolvePart('#123456', P.colors), '#123456');
  assert.equal(partVar('decoBig'), '--part-deco-big');
});

test('狀態：設定、改成預設、全部重設；不認得的元件或顏色不改變狀態', () => {
  let s = createState();
  assert.deepEqual(s.custom, {});
  s = setPartColor(s, 'title', '#aa3322');
  assert.deepEqual(s.custom, { title: '#AA3322' });
  assert.equal(s.customPart, 'title');
  s = setPartColor(s, 'qno', 'secondary');
  assert.deepEqual(s.custom, { title: '#AA3322', qno: 'secondary' });
  assert.equal(setPartColor(s, 'nope', 'accent'), s);
  assert.equal(setPartColor(s, 'title', 'pink'), s);
  s = setPartColor(s, 'title', null);
  assert.deepEqual(s.custom, { qno: 'secondary' });
  assert.deepEqual(resetCustom(s).custom, {});
});

test('驗證：custom 可省略；元件或顏色不對時不通過', () => {
  assert.equal(validatePalette({ ...P, custom: { title: '#112233', card1: 'accent' } }).valid, true);
  for (const bad of [null, [], { nope: '#112233' }, { title: 'pink' }, { toString: 'accent' }, { title: '#abcdef' }]) {
    assert.equal(validatePalette({ ...P, custom: bad }).valid, false, JSON.stringify(bad));
  }
  assert.equal(isCustomMap({}), true);
});

test('收藏：元件配色和漸層一起保存，套用時還原；改了元件配色會更新原本那筆', () => {
  const s = memStorage();
  let st = setPartColor({ ...createState(), gradients: [{ key: 'main', target: 'hero', dir: 'diag' }] }, 'background', '#FFF8E7');
  assert.equal(addFavorite(paletteForFavorite(P, st), s).ok, true);
  let [saved] = loadFavorites(s).palettes;
  assert.deepEqual(saved.custom, { background: '#FFF8E7' });
  assert.equal(saved.gradient.key, 'main');

  st = setPartColor(st, 'button', 'secondary');
  const r = addFavorite(paletteForFavorite(P, st), s);
  assert.match(r.message, /更新/);
  [saved] = loadFavorites(s).palettes;
  assert.equal(loadFavorites(s).palettes.length, 1);
  assert.deepEqual(saved.custom, { background: '#FFF8E7', button: 'secondary' });

  const back = applyFavorite(createState(), saved);
  assert.deepEqual(back.custom, { background: '#FFF8E7', button: 'secondary' });
  assert.equal(back.gradients[0].key, 'main');
  assert.deepEqual(applyFavorite(back, { ...P }).custom, {}, '收藏沒有元件配色時清空');
  assert.ok(!('custom' in paletteForFavorite(P, createState())), '沒有自訂時不寫 custom 欄位');
});

test('匯出：沒有自訂時與舊版相同；有自訂時每種格式都附上', () => {
  for (const make of [hexList, rgbList, cssVariables, cssOklch, slidesThemeText]) assert.equal(make(P, null, {}), make(P));
  assert.equal(toYaml(P, null, {}), toYaml(P));

  const custom = { title: '#AA3322', card1: 'accent' };
  const entries = customEntries(custom, P.colors);
  assert.deepEqual(entries.map((e) => e.key), ['title', 'card1'], '依 PARTS 順序');
  for (const make of [hexList, cssVariables, cssOklch, slidesThemeText]) {
    const out = make(P, null, custom);
    assert.ok(out.includes('#AA3322') && out.includes(P.colors.accent.hex), make.name);
  }
  assert.ok(hexList(P, null, custom).includes('標題（簡報、網頁、學習單）：#AA3322'));
  assert.ok(hexList(P, null, custom).includes(`卡片 1（作業）（網頁）：${P.colors.accent.hex}（點綴色）`));
  assert.ok(cssVariables(P, null, custom).includes('  --part-title: #AA3322; /* 標題 */'));
  assert.ok(cssVariables(P, null, custom).trimEnd().endsWith('}'));

  const y = toYaml(P, null, custom);
  assert.ok(y.endsWith(`components:\n  title: "#AA3322"\n  card1: "${P.colors.accent.hex}"\n`), y);
  assert.ok(!/\t/.test(y));
  assert.ok(toFullPrompt(P, null, custom).includes('title＝標題、card1＝卡片 1（作業）'));
});
