// 網路推薦配色與手機分頁（2026-10-06 使用者新增）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_PALETTES, WEB_SERIES } from '../src/data/web-palettes.js';
import { pieCss, webToPalette, palettesOf, ALL_SERIES } from '../src/ui/web-palettes.js';
import { contrastRatio } from '../src/color/contrast.js';
import { validatePalette } from '../src/data/schema.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('資料格式：編號不重複、系列都在清單內、每組 2–5 色、大寫 6 碼 HEX、有名稱', () => {
  assert.ok(WEB_PALETTES.length >= 70);
  assert.equal(new Set(WEB_PALETTES.map((p) => p.id)).size, WEB_PALETTES.length);
  WEB_PALETTES.forEach((p, i) => {
    assert.equal(p.id, `W-${String(i + 1).padStart(3, '0')}`);
    assert.ok(WEB_SERIES.includes(p.series), p.id);
    assert.ok(p.name.trim(), p.id);
    assert.ok(p.colors.length >= 2 && p.colors.length <= 5, p.id);
    for (const c of p.colors) {
      assert.match(c.hex, /^#[0-9A-F]{6}$/, `${p.id} ${c.hex}`);
      assert.ok(c.name.trim() && !c.name.includes('#') && !/[()（）]/.test(c.name), `${p.id} 色名需整理過`);
    }
  });
  assert.deepEqual([...new Set(WEB_PALETTES.map((p) => p.series))], WEB_SERIES, '系列清單與資料順序一致');
});

test('資料不含圖片檔名與網址', () => {
  const src = read('src/data/web-palettes.js');
  assert.doesNotMatch(src, /\.(jpe?g|png|webp)|https?:\/\/|Camera_|Screenshot_|IMG_/i);
});

test('切分圓形：每個顏色等分，角度接起來是 360°', () => {
  assert.equal(pieCss([{ hex: '#111111' }, { hex: '#222222' }]), 'conic-gradient(#111111 0deg 180deg, #222222 180deg 360deg)');
  assert.equal(pieCss([{ hex: '#111111' }, { hex: '#222222' }, { hex: '#333333' }]),
    'conic-gradient(#111111 0deg 120deg, #222222 120deg 240deg, #333333 240deg 360deg)');
});

test('用這組推薦：整組套用，五個角色都是合法配色，主色、輔色、點綴色只用這組的顏色', () => {
  for (const p of WEB_PALETTES) {
    const pal = webToPalette(p);
    const own = p.colors.map((c) => c.hex);
    assert.equal(validatePalette(pal).valid, true, `${p.id} ${validatePalette(pal).errors}`);
    assert.equal(pal.name, p.name);
    for (const r of ['primary', 'secondary', 'accent']) assert.ok(own.includes(pal.colors[r].hex), `${p.id} ${r}`);
    assert.ok(contrastRatio(pal.colors.text.hex, pal.colors.background.hex) >= 4.5, `${p.id} 字色對比`);
  }
});

test('用這組推薦：有夠淡的顏色就當底色、夠深的就當字色，不另外補色', () => {
  const pal = webToPalette({ id: 'T', name: '測試', colors: [{ name: '白', hex: '#F7F2EE' }, { name: '紅', hex: '#E7688B' }, { name: '青', hex: '#3E5968' }] });
  assert.equal(pal.colors.background.hex, '#F7F2EE');
  assert.equal(pal.colors.text.hex, '#3E5968');
  assert.equal(pal.colors.primary.hex, '#E7688B');
  assert.ok(!pal.checks.warnings.some((w) => w.includes('補色')));
});

test('用這組推薦：兩色鮮豔配色補底色與字色，點綴色沿用輔色並註明', () => {
  const pal = webToPalette(WEB_PALETTES.find((p) => p.id === 'W-001'));
  assert.equal(pal.colors.primary.hex, '#E7688B');
  assert.equal(pal.colors.secondary.hex, '#86CBB0');
  assert.equal(pal.colors.accent.hex, '#86CBB0');
  assert.ok(pal.checks.warnings.some((w) => w.includes('底色') && w.includes('字色')));
  assert.ok(pal.checks.warnings.includes('點綴色沿用輔色'));
});

test('系列篩選：全部等於總數，各系列加總也等於總數', () => {
  assert.equal(palettesOf(ALL_SERIES).length, WEB_PALETTES.length);
  assert.equal(WEB_SERIES.reduce((n, s) => n + palettesOf(s).length, 0), WEB_PALETTES.length);
});

test('手機分頁：每個底部選單都有對應的頁面區塊，左欄屬於推薦頁', () => {
  const html = read('index.html');
  const navs = [...html.matchAll(/data-nav="([^"]+)"/g)].map((m) => m[1]);
  const pages = new Set([...html.matchAll(/data-page="([^"]+)"/g)].map((m) => m[1]));
  assert.deepEqual(navs, ['pick', 'preview', 'roles', 'web', 'saved']);
  for (const n of navs) assert.ok(pages.has(n), `缺少 data-page="${n}"`);
  assert.match(html, /class="col col-left" data-page="pick"/);
  const css = read('src/ui/styles.css');
  for (const n of navs.filter((x) => x !== 'pick')) assert.ok(css.includes(`body[data-page="${n}"] .layout [data-page]:not([data-page="${n}"])`), n);
});
