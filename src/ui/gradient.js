// 漸層搭配建議（2026-10-06 使用者新增）：用目前配色組出 5 種漸層，可複製 CSS 或套用到預覽。
// 使用者可自選漸層用在哪個元件、方向；選定的漸層也會放進「匯出」與「複製給 AI」。
// 2026-10-07 使用者新增：可同時選用多個漸層。
// 2026-10-08 使用者決定：「用在哪裡」與元件配色相同，用下拉式選單細到每個元件，每個元件各一個漸層。
// 漸層色票屬於「使用者資料」，以 inline style 設定。
import { h, icon, mount } from './dom.js';
import { copyText } from './copy.js';
import { contrastRatio } from '../color/contrast.js';
import { gradientSuggestions, pickGradients, gradientTargetsFor, GRADIENT_TARGETS, GRADIENT_DIRS, DEFAULT_GRADIENT_TARGET } from '../color/gradient.js';
import { PREVIEW_LABELS } from '../data/parts.js';

/** 元件名稱；不在目前預覽的元件加註出現在哪種預覽 */
const targetLabel = (t, type) => {
  const o = GRADIENT_TARGETS[t];
  return o.types.includes(type) ? o.label : `${o.label}（${o.types.map((x) => PREVIEW_LABELS[x]).join('、')}）`;
};

const seg = (label, options, current, onPick) => h('div', { class: 'chips chips-wrap', role: 'group', 'aria-label': label },
  Object.entries(options).map(([key, o]) => h('button', {
    type: 'button', class: 'chip', title: o.desc, 'aria-pressed': String(current === key), on: { click: () => onPick(key) },
  }, o.label)));

/**
 * @param {HTMLElement} panel
 * @param {object} palette 目前套用中的配色
 * @param {{ list: { key: string, target: string, dir: string }[], target: string, dir: string, type: string }} sel
 *   list：已選用的漸層；target、dir：正在設定的元件與方向；type：目前的預覽類型（決定選單列出哪些元件）
 * @param {number} minText 放字需要的對比度
 * @param {{ onApply: (key: string) => void, onRemove: (target: string) => void, onTarget: (t: string) => void, onDir: (d: string) => void }} handlers
 */
export function renderGradients(panel, palette, sel, minText, { onApply, onRemove, onTarget, onDir }) {
  const list = gradientSuggestions(palette.colors, { min: minText, dir: sel.dir });
  const chosen = pickGradients(palette.colors, sel.list, minText);
  const targets = gradientTargetsFor(sel.type);
  const target = targets.includes(sel.target) ? sel.target : DEFAULT_GRADIENT_TARGET;
  const here = GRADIENT_TARGETS[target].label;
  const isText = GRADIENT_TARGETS[target].kind === 'text';
  // 「用在哪裡」：下拉式選單列出目前預覽的元件（與元件配色相同），已選用的元件標出漸層名稱
  const targetSelect = h('select', { class: 'part-select', id: 'grad-target-select', on: { change: () => onTarget(targetSelect.value) } },
    targets.map((k) => {
      const used = chosen.find((x) => x.target === k);
      return h('option', { value: k }, `${GRADIENT_TARGETS[k].label}${used ? `（已選用：${used.name}）` : ''}`);
    }));
  targetSelect.value = target;
  /** 漸層文字：每一段對底色的對比都要夠，才算清楚 */
  const textNote = (g) => {
    const ratio = Math.min(...g.stops.map((x) => contrastRatio(x.hex, palette.colors.background.hex)));
    return ratio >= minText
      ? `做成漸層文字也清楚（對底色 ${ratio.toFixed(1)}:1）`
      : `做成漸層文字時最淡的地方不夠清楚（對底色 ${ratio.toFixed(1)}:1），建議換深一點的漸層`;
  };
  const item = (g) => {
    const on = chosen.some((x) => x.key === g.key && x.target === target);
    const elsewhere = chosen.filter((x) => x.key === g.key && x.target !== target).map((x) => targetLabel(x.target, sel.type));
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
        h('div', { class: 'grad-note' }, isText ? textNote(g) : g.text.hex
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
    h('p', { class: 'hint' }, '用目前的配色組成漸層。先從「用在哪裡」選一個元件（清單跟著上面的預覽類型變）、再選「方向」，按「選用這個漸層」，上面的預覽會跟著變，匯出與複製給 AI 也會一起帶上。換一個元件再選，就能讓每個元件各用自己喜歡的漸層；文字類元件會做成漸層文字。框線類元件不適合漸層，所以不列出。'),
    chosen.length ? h('div', { class: 'grad-chosen' },
      h('span', { class: 'grad-opt-label' }, `已選用 ${chosen.length} 個漸層`),
      h('ul', { class: 'part-list' }, chosen.map((x) => h('li', {},
        h('button', {
          type: 'button', class: 'chip part-chip', title: '取消這個漸層', 'aria-label': `取消${targetLabel(x.target, sel.type)}的${x.name}`,
          on: { click: () => onRemove(x.target) },
        },
        h('span', { class: 'fav-grad-bar', 'data-user-color': true, 'aria-hidden': 'true', style: { background: x.css } }),
        `${targetLabel(x.target, sel.type)}：${x.name}`, icon('close')))))) : null,
    h('label', { class: 'grad-opt part-opt' }, h('span', { class: 'grad-opt-label' }, '用在哪裡'), targetSelect),
    h('div', { class: 'grad-opt' }, h('span', { class: 'grad-opt-label' }, '方向'), seg('漸層方向', GRADIENT_DIRS, sel.dir, onDir)),
    h('ul', { class: 'grad-list' }, list.map(item)));
}
