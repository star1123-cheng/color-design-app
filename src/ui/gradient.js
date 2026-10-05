// 漸層搭配建議（2026-10-06 使用者新增）：用目前配色組出幾種漸層，可複製 CSS 或套用到預覽。
// 漸層色票屬於「使用者資料」，以 inline style 設定。
import { h, icon, mount } from './dom.js';
import { copyText } from './copy.js';
import { gradientSuggestions } from '../color/gradient.js';

/**
 * @param {HTMLElement} panel
 * @param {object} palette 目前套用中的配色
 * @param {string|null} selected 已套用到預覽的漸層 key
 * @param {number} minText 放字需要的對比度
 * @param {(key: string|null) => void} onApply
 */
export function renderGradients(panel, palette, selected, minText, onApply) {
  const list = gradientSuggestions(palette.colors, { min: minText });
  const item = (g) => {
    const on = selected === g.key;
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
        }, icon(on ? 'check' : 'eye'), on ? '預覽中' : '套用到預覽'),
        h('button', {
          type: 'button', class: 'btn',
          on: { click: () => copyText(`background: ${g.css};`, `${g.name} CSS`) },
        }, icon('copy'), '複製 CSS')));
  };

  mount(panel,
    h('div', { class: 'typo-head' },
      h('h3', {}, '漸層搭配建議'),
      h('span', { class: 'mono-note' }, `${list.length} 種`)),
    h('p', { class: 'hint' }, '用目前的配色組成漸層，適合封面、橫幅或按鈕。按「套用到預覽」可以在上面的預覽看看效果。'),
    h('ul', { class: 'grad-list' }, list.map(item)));
}
