// 推薦卡片：上方 60／18／12／10 比例條（底色、主色、輔色、點綴），下方類型標籤、對比度與色碼
import { h, icon, mount } from './dom.js';

const RATIO = [['background', 60], ['primary', 18], ['secondary', 12], ['accent', 10]];

/** 比例條（推薦卡片與預覽區共用） */
export function ratioBar(colors, extraClass = '') {
  return h('span', { class: `ratio ${extraClass}`.trim(), 'aria-hidden': 'true', 'data-user-color': true },
    RATIO.map(([role, w]) => h('span', { style: { width: `${w}%`, background: colors[role].hex } })));
}

// 推薦卡片的標籤：類型（例如「冷暖對比型」）＋提醒數
const defaultTags = (p) => [
  { text: p.name.replace(/\s*\d+$/, '') },
  ...(p.checks.warnings.length ? [{ text: `${p.checks.warnings.length} 個提醒`, sand: true, icon: 'alert' }] : []),
];

/**
 * @param {HTMLElement} list ul 容器
 * @param {object[]} palettes SPEC 3.1 配色陣列（推薦結果或範本）
 * @param {number} selected 目前選取的索引
 * @param {(index: number) => void} onSelect
 * @param {{ tags?: (p: object) => {text: string, sand?: boolean, icon?: string}[], showWarnings?: boolean }} [options]
 */
export function renderCards(list, palettes, selected, onSelect, { tags = defaultTags, showWarnings = true } = {}) {
  const items = palettes.map((p, i) => {
    const { textOnBackground } = p.checks.contrast;
    const warnings = showWarnings ? p.checks.warnings : [];
    const hexes = ['primary', 'secondary', 'background', 'text'].map((r) => p.colors[r].hex);
    // button 內只能放行內元素，因此全部使用 span，再用 CSS 調整排版
    const card = h('button', {
      type: 'button',
      class: 'card',
      'aria-pressed': String(i === selected),
      'aria-label': `${tags(p).map((t) => t.text).join('，')}，主色 ${p.colors.primary.hex}，輔色 ${p.colors.secondary.hex}，字色對比 ${textOnBackground.toFixed(1)} 比 1`,
      on: { click: () => onSelect(i) },
    },
    ratioBar(p.colors),
    h('span', { class: 'card-meta' },
      h('span', { class: 'card-tags' },
        tags(p).map((t) => h('span', { class: t.sand ? 'tag tag-sand' : 'tag' }, t.icon ? icon(t.icon) : null, t.text))),
      h('span', { class: 'card-contrast' }, icon('check'), `對比 ${textOnBackground.toFixed(1)}:1`)),
    h('span', { class: 'card-hexes' }, hexes.join('  ·  ')),
    warnings.map((w) => h('span', { class: 'card-warn' }, w)));
    return h('li', {}, card);
  });
  mount(list, items);
}
