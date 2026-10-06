// 漸層搭配建議（2026-10-06 使用者新增）：用目前配色組出 5 種漸層，可複製 CSS 或套用到預覽。
// 使用者可自選漸層用在哪個元件、方向；選定的漸層也會放進「匯出」與「複製給 AI」。
// 2026-10-07 使用者新增：可同時選用多個漸層，每個用途（整頁背景、橫幅、按鈕、裝飾）各一個。
// 漸層色票屬於「使用者資料」，以 inline style 設定。
import { h, icon, mount } from './dom.js';
import { copyText } from './copy.js';
import { gradientSuggestions, pickGradients, GRADIENT_TARGETS, GRADIENT_DIRS } from '../color/gradient.js';

const seg = (label, options, current, onPick) => h('div', { class: 'chips chips-wrap', role: 'group', 'aria-label': label },
  Object.entries(options).map(([key, o]) => h('button', {
    type: 'button', class: 'chip', title: o.desc, 'aria-pressed': String(current === key), on: { click: () => onPick(key) },
  }, o.label)));

/**
 * @param {HTMLElement} panel
 * @param {object} palette 目前套用中的配色
 * @param {{ list: { key: string, target: string, dir: string }[], target: string, dir: string }} sel
 *   list：已選用的漸層；target、dir：正在設定的用途與方向
 * @param {number} minText 放字需要的對比度
 * @param {{ onApply: (key: string) => void, onRemove: (target: string) => void, onTarget: (t: string) => void, onDir: (d: string) => void }} handlers
 */
export function renderGradients(panel, palette, sel, minText, { onApply, onRemove, onTarget, onDir }) {
  const list = gradientSuggestions(palette.colors, { min: minText, dir: sel.dir });
  const chosen = pickGradients(palette.colors, sel.list, minText);
  const here = GRADIENT_TARGETS[sel.target].label;
  const item = (g) => {
    const on = chosen.some((x) => x.key === g.key && x.target === sel.target);
    const elsewhere = chosen.filter((x) => x.key === g.key && x.target !== sel.target).map((x) => GRADIENT_TARGETS[x.target].label);
    return h('li', { class: 'grad' },
      h('div', {
        class: 'grad-swatch', 'data-user-color': true, role: 'img',
        'aria-label': `${g.name}：${g.stops.map((s) => s.hex).join(' 到 ')}`,
        style: { background: g.css, color: g.text.hex ?? palette.colors.text.hex },
      }, g.text.hex ? h('span', { class: 'grad-sample' }, '標題文字') : h('span', { class: 'grad-sample grad-sample-box', style: { background: palette.colors.background.hex } }, '要加底塊')),
      h('div', { class: 'grad-info' },
        h('div', { class: 'grad-name' }, g.name),
        h('div', { class: 'grad-desc' }, g.desc),
        h('div', { class: 'grad-hexes' }, g.stops.map((s) => s.hex).join(' → ')),
        h('div', { class: 'grad-note' }, g.text.hex
          ? `字直接放上去也清楚（對比 ${g.text.ratio.toFixed(1)}:1）`
          : '字直接放上去不夠清楚，請加一塊底色再放字'),
        elsewhere.length ? h('div', { class: 'grad-note' }, `也用在：${elsewhere.join('、')}`) : null),
      h('div', { class: 'grad-actions' },
        h('button', {
          type: 'button', class: 'btn', 'aria-pressed': String(on),
          'aria-label': on ? `取消${here}的${g.name}` : `把${g.name}用在${here}`,
          on: { click: () => onApply(g.key) },
        }, icon(on ? 'check' : 'eye'), on ? `已用在${here}` : '選用這個漸層'),
        h('button', {
          type: 'button', class: 'btn',
          on: { click: () => copyText(`background: ${g.css};`, `${g.name} CSS`) },
        }, icon('copy'), '複製 CSS')));
  };

  mount(panel,
    h('div', { class: 'typo-head' },
      h('h3', {}, '漸層搭配建議'),
      h('span', { class: 'mono-note' }, `${list.length} 種`)),
    h('p', { class: 'hint' }, '用目前的配色組成漸層。先選「用在哪裡」和「方向」，再按「選用這個漸層」，上面的預覽會跟著變，匯出與複製給 AI 也會一起帶上。換一個「用在哪裡」再選，就能同時使用多個漸層（每個位置一個）。'),
    chosen.length ? h('div', { class: 'grad-chosen' },
      h('span', { class: 'grad-opt-label' }, `已選用 ${chosen.length} 個漸層`),
      h('ul', { class: 'part-list' }, chosen.map((x) => h('li', {},
        h('button', {
          type: 'button', class: 'chip part-chip', title: '取消這個漸層', 'aria-label': `取消${GRADIENT_TARGETS[x.target].label}的${x.name}`,
          on: { click: () => onRemove(x.target) },
        },
        h('span', { class: 'fav-grad-bar', 'data-user-color': true, 'aria-hidden': 'true', style: { background: x.css } }),
        `${GRADIENT_TARGETS[x.target].label}：${x.name}`, icon('close')))))) : null,
    h('div', { class: 'grad-opt' }, h('span', { class: 'grad-opt-label' }, '用在哪裡'), seg('漸層用在哪裡', GRADIENT_TARGETS, sel.target, onTarget)),
    h('div', { class: 'grad-opt' }, h('span', { class: 'grad-opt-label' }, '方向'), seg('漸層方向', GRADIENT_DIRS, sel.dir, onDir)),
    h('ul', { class: 'grad-list' }, list.map(item)));
}
