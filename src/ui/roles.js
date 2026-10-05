// 五個角色與複製 HEX
import { h, icon, mount } from './dom.js';
import { copyText } from './copy.js';

export const ROLE_LABELS = { primary: '主色', secondary: '輔色', background: '底色', text: '字色', accent: '點綴色' };

/** 色碼清單文字（「複製全部」與程式碼區塊共用） */
export const hexListText = (palette) =>
  Object.entries(ROLE_LABELS).map(([role, label]) => `${label.padEnd(3, '　')} ${palette.colors[role].hex}`).join('\n');

/**
 * @param {HTMLElement} list ul 容器
 * @param {HTMLElement} copyAllBtn 色碼區的「複製全部」按鈕（文字由這裡產生）
 * @param {HTMLElement} codeEl
 * @param {object} palette 目前選取的配色
 * @param {HTMLElement[]} [extraCopyBtns] 其他「複製全部」按鈕（例如電腦版頂部列），只綁定動作、不改文字
 */
export function renderRoles(list, copyAllBtn, codeEl, palette, extraCopyBtns = []) {
  mount(list, Object.entries(ROLE_LABELS).map(([role, label]) => {
    const { hex } = palette.colors[role];
    return h('li', { class: 'role' },
      h('span', { class: 'role-swatch', style: { background: hex }, 'data-user-color': true, 'aria-hidden': 'true' }),
      h('div', {}, h('div', { class: 'role-name' }, label), h('div', { class: 'role-hex' }, hex)),
      h('button', { type: 'button', class: 'btn', 'aria-label': `複製${label} ${hex}`, on: { click: () => copyText(hex, hex) } },
        icon('copy'), '複製'));
  }));
  const text = hexListText(palette);
  codeEl.textContent = text;
  mount(copyAllBtn, icon('copy'), '複製全部 HEX');
  for (const btn of [copyAllBtn, ...extraCopyBtns]) btn.onclick = () => copyText(text, '全部 5 個色碼');
}
