// 五個角色與複製 HEX（各種匯出格式在 src/ui/export.js）
import { h, icon, mount } from './dom.js';
import { copyText } from './copy.js';
import { ROLE_LABELS, hexList } from '../export/formats.js';

export { ROLE_LABELS };
/** 色碼清單文字（與匯出區的 HEX 格式相同） */
export const hexListText = hexList;

/**
 * @param {HTMLElement} list ul 容器
 * @param {object} palette 目前選取的配色
 * @param {HTMLElement[]} [copyAllBtns] 「複製全部 HEX」按鈕（例如電腦版頂部列），只綁定動作、不改文字
 */
export function renderRoles(list, palette, copyAllBtns = []) {
  mount(list, Object.entries(ROLE_LABELS).map(([role, label]) => {
    const { hex } = palette.colors[role];
    return h('li', { class: 'role' },
      h('span', { class: 'role-swatch', style: { background: hex }, 'data-user-color': true, 'aria-hidden': 'true' }),
      h('div', {}, h('div', { class: 'role-name' }, label), h('div', { class: 'role-hex' }, hex)),
      h('button', { type: 'button', class: 'btn', 'aria-label': `複製${label} ${hex}`, on: { click: () => copyText(hex, hex) } },
        icon('copy'), '複製'));
  }));
  const text = hexList(palette);
  for (const btn of copyAllBtns) btn.onclick = () => copyText(text, '全部 5 個色碼');
}
