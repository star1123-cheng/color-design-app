// 網路推薦配色（2026-10-06 使用者新增）：切分圓形色票＋色名與色碼，依系列篩選。
// 資料在 src/data/web-palettes.js；色票以 inline style 設定，文字一律用 textContent（h()）。
import { h, icon, mount } from './dom.js';
import { copyText } from './copy.js';
import { hexToOklch } from '../color/oklch.js';
import { WEB_PALETTES, WEB_SERIES } from '../data/web-palettes.js';

export const ALL_SERIES = '全部';

/** 切分圓形：每個顏色等分一塊，從 12 點鐘方向順時針排列 */
export function pieCss(colors) {
  const step = 360 / colors.length;
  const parts = colors.map((c, i) => `${c.hex} ${Math.round(i * step * 100) / 100}deg ${Math.round((i + 1) * step * 100) / 100}deg`);
  return `conic-gradient(${parts.join(', ')})`;
}

/**
 * 「用這組推薦」要拿哪個顏色當主色：彩度最高的那個；整組幾乎都是灰白時，取明度最接近中間的
 * @returns {{ name: string, hex: string }}
 */
export function seedColor(colors) {
  const scored = colors.map((c) => ({ c, lch: hexToOklch(c.hex) }));
  const maxC = Math.max(...scored.map((x) => x.lch[1]));
  if (maxC >= 0.03) return scored.find((x) => x.lch[1] === maxC).c;
  return scored.reduce((a, b) => (Math.abs(b.lch[0] - 0.6) < Math.abs(a.lch[0] - 0.6) ? b : a)).c;
}

/** 某個系列的配色（全部時回傳全部） */
export const palettesOf = (series) => WEB_PALETTES.filter((p) => series === ALL_SERIES || p.series === series);

function card(p, onUse) {
  const seed = seedColor(p.colors);
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
      h('button', { type: 'button', class: 'btn btn-solid', title: `用「${seed.name}」當主色`, on: { click: () => onUse(seed, p) } }, icon('palette'), '用這組推薦'),
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
 * @param {{ onSeries: (s: string) => void, onUse: (color: {name: string, hex: string}, p: object) => void }} handlers
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
