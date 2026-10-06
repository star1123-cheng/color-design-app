// 收藏清單（階段 4）：套用、改名、刪除。資料讀寫在 src/data/favorites.js。
import { h, icon, mount } from './dom.js';
import { ratioBar } from './cards.js';
import { pickGradients, GRADIENT_TARGETS } from '../color/gradient.js';

/** 收藏的漸層：色條＋名稱與用途（色碼由五色重算；可能有多個） */
function gradientRow(p) {
  return pickGradients(p.colors, p.gradient).map((g) => h('span', { class: 'fav-grad' },
    h('span', { class: 'fav-grad-bar', 'data-user-color': true, 'aria-hidden': 'true', style: { background: g.css } }),
    `漸層：${g.name}・${GRADIENT_TARGETS[g.target].label}`));
}

/**
 * @param {HTMLElement} list ul 容器
 * @param {HTMLElement} empty 空資料提示
 * @param {object[]} favorites
 * @param {{ onApply: (p: object) => void, onRemove: (id: string) => void, onRename: (id: string, name: string) => void }} handlers
 */
export function renderFavorites(list, empty, favorites, { onApply, onRemove, onRename }) {
  empty.hidden = favorites.length > 0;
  mount(list, favorites.map((p) => {
    const name = h('input', { type: 'text', class: 'fav-name', maxlength: '30', 'aria-label': '收藏名稱（可修改）' });
    name.value = p.name; // 使用者輸入的文字只放進 value，不當 HTML
    name.addEventListener('change', () => onRename(p.id, name.value));
    return h('li', { class: 'fav' },
      ratioBar(p.colors),
      name,
      gradientRow(p),
      h('span', { class: 'card-hexes' }, ['primary', 'secondary', 'background', 'text', 'accent'].map((r) => p.colors[r].hex).join('  ·  ')),
      h('div', { class: 'fav-actions' },
        h('button', { type: 'button', class: 'btn btn-solid', on: { click: () => onApply(p) } }, icon('eye'), '套用'),
        h('button', { type: 'button', class: 'btn', 'aria-label': `刪除收藏 ${p.name}`, on: { click: () => onRemove(p.id) } }, icon('close'), '刪除')));
  }));
}
