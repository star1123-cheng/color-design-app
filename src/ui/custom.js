// 元件配色面板（2026-10-06 使用者新增）：選一個預覽元件，改用配色裡的其他顏色或自訂顏色。
// 色票屬於「使用者資料」，以 inline style 設定；文字一律用 textContent（h()）。
import { h, icon, mount } from './dom.js';
import { contrastRatio, CONTRAST } from '../color/contrast.js';
import { ROLE_LABELS } from '../export/formats.js';
import { PARTS, ROLES, partsFor, isPartValue, resolvePart, customEntries, PREVIEW_LABELS } from '../data/parts.js';

/** 這個元件改色後的提醒（文字對比、背景上的字） */
function note(part, hex, palette, custom, minText) {
  const c = palette.colors;
  const kind = PARTS[part].kind;
  if (kind === 'text') {
    const bg = isPartValue(custom.background) ? resolvePart(custom.background, c) : c.background.hex;
    const min = part === 'title' ? CONTRAST.largeText : minText;
    const r = contrastRatio(hex, bg);
    return r >= min ? `對背景 ${r.toFixed(1)}:1，看得清楚` : `對背景只有 ${r.toFixed(1)}:1（建議至少 ${min}:1），字可能看不清楚`;
  }
  if (kind === 'page') {
    const r = contrastRatio(c.text.hex, hex);
    return r >= minText ? `字色在這個背景上 ${r.toFixed(1)}:1，看得清楚` : `字色在這個背景上只有 ${r.toFixed(1)}:1，建議換淺一點的背景`;
  }
  if (kind === 'fill') return '色塊上的字會自動挑看得清楚的顏色';
  if (kind === 'tint') return '卡片底色會自動取這個顏色的淡色，圓點用原色';
  return '框線顏色';
}

/**
 * @param {HTMLElement} panel
 * @param {object} palette 目前套用中的配色
 * @param {string} type 預覽類型
 * @param {{ custom: Record<string, string>, part: string }} st 元件配色與正在調整的元件
 * @param {number} minText 正文需要的對比度
 * @param {{ onPart: (p: string) => void, onSet: (p: string, v: string|null) => void, onReset: () => void }} handlers
 */
export function renderCustom(panel, palette, type, { custom, part }, minText, { onPart, onSet, onReset }) {
  const c = palette.colors;
  const parts = partsFor(type);
  const value = custom[part];
  const set = isPartValue(value);
  const entries = customEntries(custom, c);

  const select = h('select', { class: 'part-select', id: 'part-select', on: { change: () => onPart(select.value) } },
    parts.map((k) => h('option', { value: k }, `${PARTS[k].label}${isPartValue(custom[k]) ? '（已自訂）' : ''}`)));
  select.value = part;

  const swatch = (hex) => h('span', { class: 'part-dot', 'data-user-color': true, 'aria-hidden': 'true', style: { background: hex } });
  const roleBtn = (r) => h('button', {
    type: 'button', class: 'chip part-chip', 'aria-pressed': String(value === r),
    'aria-label': `${PARTS[part].label}改用${ROLE_LABELS[r]} ${c[r].hex}`,
    on: { click: () => onSet(part, r) },
  }, swatch(c[r].hex), ROLE_LABELS[r]);

  // 自訂顏色：原生取色器；change 在關閉取色器時才觸發，避免拖曳時一直重畫
  const picker = h('input', { type: 'color', class: 'part-color', 'aria-label': `${PARTS[part].label}自訂顏色` });
  picker.value = (set ? resolvePart(value, c) : c.primary.hex).toLowerCase();
  picker.addEventListener('change', () => onSet(part, picker.value.toUpperCase()));
  const customOn = set && !ROLES.includes(value);

  mount(panel,
    h('div', { class: 'typo-head' },
      h('h3', {}, '元件配色'),
      h('span', { class: 'mono-note' }, entries.length ? `已自訂 ${entries.length} 個` : PREVIEW_LABELS[type])),
    h('p', { class: 'hint' }, '直接點上面預覽裡的元件，或從選單挑一個，再選顏色。可以用這組配色的顏色，也可以自訂任何顏色；會一起存進收藏與匯出。'),
    h('label', { class: 'grad-opt' }, h('span', { class: 'grad-opt-label' }, '要調整的元件'), select),
    h('div', { class: 'chips chips-wrap part-chips', role: 'group', 'aria-label': `${PARTS[part].label}的顏色` },
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!set), on: { click: () => onSet(part, null) } }, '預設'),
      ROLES.map(roleBtn),
      h('label', { class: customOn ? 'chip part-chip part-custom is-on' : 'chip part-chip part-custom' },
        picker, customOn ? value : '自訂顏色')),
    set ? h('p', { class: 'grad-note part-note' }, note(part, resolvePart(value, c), palette, custom, minText)) : null,
    entries.length ? h('div', { class: 'part-summary' },
      h('ul', { class: 'part-list' }, entries.map((e) => h('li', {},
        h('button', { type: 'button', class: 'chip part-chip', title: `出現在：${e.types.join('、')}`, on: { click: () => onPart(e.key) } },
          swatch(e.hex), `${e.label} ${e.hex}`)))),
      h('button', { type: 'button', class: 'btn', on: { click: onReset } }, icon('close'), '全部重設')) : null);
}
