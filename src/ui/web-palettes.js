// 網路推薦配色（2026-10-06 使用者新增）：切分圓形色票＋色名與色碼，依系列篩選。
// 資料在 src/data/web-palettes.js；色票以 inline style 設定，文字一律用 textContent（h()）。
import { h, icon, mount } from './dom.js';
import { copyText } from './copy.js';
import { hexToOklch } from '../color/oklch.js';
import { quantize } from '../color/gamut.js';
import { contrastRatio } from '../color/contrast.js';
import { makeText } from '../color/palette.js';
import { toPalette, SOURCE_SAMPLE, SOURCE_ENGINE } from '../data/template-palette.js';
import { WEB_PALETTES, WEB_SERIES } from '../data/web-palettes.js';

export const ALL_SERIES = '全部';

/** 切分圓形：每個顏色等分一塊，從 12 點鐘方向順時針排列 */
export function pieCss(colors) {
  const step = 360 / colors.length;
  const parts = colors.map((c, i) => `${c.hex} ${Math.round(i * step * 100) / 100}deg ${Math.round((i + 1) * step * 100) / 100}deg`);
  return `conic-gradient(${parts.join(', ')})`;
}

/** 夠淡、可以直接當底色的明度門檻（SPEC：底色 L 0.92–0.98，略放寬給網路配色） */
const BG_MIN_L = 0.9;

/**
 * 「用這組推薦」（2026-10-06 使用者決定）：整組直接套到預覽，不再只取一色當主色重新推薦。
 * 五個角色盡量用這組自己的顏色：
 * - 底色：最淡的顏色（L ≥ 0.9）；沒有夠淡的才補一個主色色相的淡底。
 * - 字色：最深的顏色（對底色達到字色門檻）；不夠深才依主色補字色。
 * - 主色、輔色、點綴色：其餘顏色依彩度由高到低分配；顏色不夠時沿用前面的顏色，不另外算新色。
 * @param {{ id: string, name: string, colors: { name: string, hex: string }[] }} p
 * @param {number} minText 字色對底色的最低對比（依場景與投影模式）
 * @returns 符合 SPEC 3.1 的配色物件；checks.warnings 會註明補色與沿用
 */
export function webToPalette(p, minText = 4.5) {
  const all = p.colors.map((c) => ({ ...c, lch: hexToOklch(c.hex) }));
  const byL = [...all].sort((a, b) => b.lch[0] - a.lch[0]);
  const byC = (list) => [...list].sort((a, b) => b.lch[1] - a.lch[1]);
  const source = {};
  const issues = [];

  const bgPick = byL[0].lch[0] >= BG_MIN_L ? byL[0] : null;
  const rest = all.filter((c) => c !== bgPick);
  const seed = byC(rest)[0] ?? byL[0];
  const bgHex = bgPick ? bgPick.hex : quantize([0.965, 0.012, seed.lch[2]]).hex;
  source.background = bgPick ? SOURCE_SAMPLE : SOURCE_ENGINE;

  const darkest = [...rest].sort((a, b) => a.lch[0] - b.lch[0])[0];
  const textPick = darkest && contrastRatio(darkest.hex, bgHex) >= minText ? darkest : null;
  const textHex = textPick ? textPick.hex : makeText(seed.lch, bgHex, minText).hex;
  source.text = textPick ? SOURCE_SAMPLE : SOURCE_ENGINE;

  // 主色、輔色、點綴色：先用沒當底色／字色的顏色；不夠時再沿用字色、主色
  let pool = byC(rest.filter((c) => c !== textPick));
  if (!pool.length) pool = byC(rest);
  if (!pool.length) pool = [byL[0]];
  const [primary, secondary = pool[0], accent = pool[1] ?? pool[0]] = pool;
  if (pool.length < 2) issues.push('輔色沿用主色');
  if (pool.length < 3) issues.push(`點綴色沿用${pool.length < 2 ? '主色' : '輔色'}`);
  for (const r of ['primary', 'secondary', 'accent']) source[r] = SOURCE_SAMPLE;

  const palette = toPalette({
    id: p.id,
    style: null,
    colors: { primary: primary.hex, secondary: secondary.hex, background: bgHex, text: textHex, accent: accent.hex },
    source,
    issues,
  });
  return { ...palette, name: p.name };
}

/** 某個系列的配色（全部時回傳全部） */
export const palettesOf = (series) => WEB_PALETTES.filter((p) => series === ALL_SERIES || p.series === series);

function card(p, onUse) {
  return h('li', { class: 'wp' },
    h('div', {
      class: 'wp-pie', 'data-user-color': true, role: 'img',
      'aria-label': `${p.name}：${p.colors.map((c) => `${c.name} ${c.hex}`).join('、')}`,
      style: { background: pieCss(p.colors) },
    }),
    h('div', { class: 'wp-head' },
      h('h3', { class: 'wp-name' }, p.name),
      h('span', { class: 'wp-series' }, p.series)),
    p.scene ? h('p', { class: 'wp-scene' }, p.scene) : null,
    h('ul', { class: 'wp-colors' }, p.colors.map((c) => h('li', {},
      h('button', { type: 'button', class: 'wp-color', 'aria-label': `複製${c.name} ${c.hex}`, on: { click: () => copyText(c.hex, `${c.name} ${c.hex}`) } },
        h('span', { class: 'wp-dot', 'data-user-color': true, 'aria-hidden': 'true', style: { background: c.hex } }),
        h('span', { class: 'wp-cname' }, c.name),
        h('span', { class: 'wp-hex' }, c.hex))))),
    h('div', { class: 'wp-actions' },
      h('button', { type: 'button', class: 'btn btn-solid', title: `把「${p.name}」整組套用到預覽`, on: { click: () => onUse(p) } }, icon('palette'), '用這組推薦'),
      h('button', {
        type: 'button', class: 'btn', 'aria-label': `複製「${p.name}」全部色碼`,
        on: { click: () => copyText(p.colors.map((c) => `${c.name} ${c.hex}`).join('\n'), `「${p.name}」${p.colors.length} 個色碼`) },
      }, icon('copy'), '複製')));
}

/**
 * @param {HTMLElement} filterEl 系列篩選
 * @param {HTMLElement} listEl 卡片清單（ul）
 * @param {HTMLElement} countEl 數量
 * @param {string} series 目前系列
 * @param {{ onSeries: (s: string) => void, onUse: (p: object) => void }} handlers
 */
export function renderWebPalettes(filterEl, listEl, countEl, series, { onSeries, onUse }) {
  const options = [ALL_SERIES, ...WEB_SERIES];
  const current = options.includes(series) ? series : ALL_SERIES;
  mount(filterEl, options.map((s) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(s === current), on: { click: () => onSeries(s) },
  }, s === ALL_SERIES ? `${s} ${WEB_PALETTES.length}` : `${s} ${palettesOf(s).length}`)));
  const list = palettesOf(current);
  countEl.textContent = `${list.length} 組`;
  mount(listEl, list.map((p) => card(p, onUse)));
}
