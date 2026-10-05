// 漸層搭配建議（2026-10-06 使用者新增）：用目前配色組出 5 種漸層，可複製 CSS 或套用到預覽。
// 使用者可自選漸層用在哪個元件、方向；選定的漸層也會放進「匯出」與「複製給 AI」。
// 漸層色票屬於「使用者資料」，以 inline style 設定。
import { h, icon, mount } from './dom.js';
import { copyText } from './copy.js';
import { gradientSuggestions, GRADIENT_TARGETS, GRADIENT_DIRS } from '../color/gradient.js';

const seg = (label, options, current, onPick) => h('div', { class: 'chips chips-wrap', role: 'group', 'aria-label': label },
  Object.entries(options).map(([key, o]) => h('button', {
    type: 'button', class: 'chip', title: o.desc, 'aria-pressed': String(current === key), on: { click: () => onPick(key) },
  }, o.label)));

/**
 * @param {HTMLElement} panel
 * @param {object} palette 目前套用中的配色
 * @param {{ key: string|null, target: string, dir: string }} sel 選定的漸層、用在哪個元件、方向
 * @param {number} minText 放字需要的對比度
 * @param {{ onApply: (key: string|null) => void, onTarget: (t: string) => void, onDir: (d: string) => void }} handlers
 */
export function renderGradients(panel, palette, sel, minText, { onApply, onTarget, onDir }) {
  const list = gradientSuggestions(palette.colors, { min: minText, dir: sel.dir });
  const item = (g) => {
    const on = sel.key === g.key;
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
          : '字直接放上去不夠清楚，請加一塊底色再放字')),
      h('div', { class: 'grad-actions' },
        h('button', {
          type: 'button', class: 'btn', 'aria-pressed': String(on),
          on: { click: () => onApply(on ? null : g.key) },
        }, icon(on ? 'check' : 'eye'), on ? '已選用' : '選用這個漸層'),
        h('button', {
          type: 'button', class: 'btn',
          on: { click: () => copyText(`background: ${g.css};`, `${g.name} CSS`) },
        }, icon('copy'), '複製 CSS')));
  };

  mount(panel,
    h('div', { class: 'typo-head' },
      h('h3', {}, '漸層搭配建議'),
      h('span', { class: 'mono-note' }, `${list.length} 種`)),
    h('p', { class: 'hint' }, '用目前的配色組成漸層。先選「用在哪裡」和「方向」，再按「選用這個漸層」，上面的預覽會跟著變，匯出與複製給 AI 也會一起帶上這個漸層。'),
    h('div', { class: 'grad-opt' }, h('span', { class: 'grad-opt-label' }, '用在哪裡'), seg('漸層用在哪裡', GRADIENT_TARGETS, sel.target, onTarget)),
    h('div', { class: 'grad-opt' }, h('span', { class: 'grad-opt-label' }, '方向'), seg('漸層方向', GRADIENT_DIRS, sel.dir, onDir)),
    h('ul', { class: 'grad-list' }, list.map(item)));
}
