// 三種迷你預覽（簡報、班級網頁、學習單）。顏色全部來自推薦結果（使用者資料）。
// 色塊上的字：優先用配色的字色或底色，兩者都未達 4.5:1 時，依 SPEC 4.3 改用黑或白中對比較高者。
// 標題：主色調深到對底色 4.5:1（只調 L，保持 H 與 C），做不到時改用字色。
import { h, mount } from './dom.js';
import { contrastRatio, bestTextOn, adjustForContrast, CONTRAST } from '../color/contrast.js';
import { ratioBar } from './cards.js';
import { simulateColors } from '../color/cvd.js';
import { quantize } from '../color/gamut.js';
import { gradientSuggestions } from '../color/gradient.js';

function onFill(fill, c) {
  for (const cand of [c.text.hex, c.background.hex]) {
    if (contrastRatio(cand, fill) >= CONTRAST.text) return cand;
  }
  return bestTextOn(fill).hex;
}

function titleColor(c) {
  const adj = adjustForContrast(c.primary.oklch, c.background.hex, CONTRAST.text);
  return adj.ok ? adj.hex : c.text.hex;
}

const deco = (c, g) => h('div', { class: 'deco', 'aria-hidden': 'true' },
  h('span', { class: 'deco-big', style: { background: g ? g.css : c.primary.hex } }),
  h('span', { class: 'deco-mid', style: { background: c.secondary.hex } }),
  h('span', { class: 'deco-dot', style: { background: c.accent.hex } }));

function slide(c, g) {
  const points = ['蒸發：水變成水蒸氣', '凝結：水蒸氣變成小水滴', '降水：小水滴聚集後落下'];
  return h('div', { class: 'mini slide', 'data-user-color': true, role: 'img', 'aria-label': '迷你簡報預覽', style: { background: c.background.hex, color: c.text.hex } },
    deco(c, g),
    h('div', { class: 'slide-body' },
      h('div', { class: 'slide-kicker' }, '自然科學'),
      h('div', { class: 'slide-title', style: { color: titleColor(c) } }, '水的旅行'),
      h('ul', { class: 'slide-list' }, points.map((t) => h('li', {}, t)))),
    h('div', { class: 'slide-no' }, '03'));
}

/** 淡色卡片底：沿用角色的色相，明度貼近底色（底色偏深時往亮一點） */
function tint(role, c) {
  const [bgL] = c.background.oklch;
  const [, C, H] = role.oklch;
  return quantize([bgL > 0.6 ? Math.max(0.9, bgL - 0.04) : bgL + 0.1, Math.min(C, 0.045), H]).hex;
}

/** 班級網頁：參考作品集網站的版面（導覽列、雙欄主視覺、淡色卡片），讓配色看起來更有質感 */
function webpage(c, g) {
  const title = titleColor(c);
  const heroGrad = g && g.text.hex; // 漸層上放得下字，才把整塊主視覺改成漸層
  const card = (role, kicker, name) => {
    const bg = tint(role, c);
    return h('div', { class: 'web-card', style: { background: bg, color: onFill(bg, c) } },
      h('span', { class: 'web-card-dot', style: { background: role.hex } }),
      h('div', { class: 'web-card-kicker' }, kicker),
      h('div', { class: 'web-card-title' }, name));
  };
  return h('div', { class: 'mini web', 'data-user-color': true, role: 'img', 'aria-label': '迷你班級網頁預覽', style: { background: c.background.hex, color: c.text.hex } },
    h('div', { class: 'web-nav' },
      h('span', { class: 'web-brand' },
        h('span', { class: 'web-logo', style: { background: c.primary.hex, color: onFill(c.primary.hex, c) } }, '5'),
        '五年一班'),
      h('span', { class: 'web-links' }, h('span', {}, '公告'), h('span', {}, '作業'), h('span', {}, '相簿')),
      h('span', { class: 'web-cta', style: { background: c.primary.hex, color: onFill(c.primary.hex, c) } }, '聯絡老師')),
    h('div', { class: heroGrad ? 'web-hero is-grad' : 'web-hero', style: heroGrad ? { background: g.css, color: g.text.hex } : {} },
      h('div', { class: 'web-copy' },
        h('span', { class: 'web-tag', style: { borderColor: c.accent.hex } }, '本週公告'),
        h('div', { class: 'web-title', style: { color: heroGrad ? g.text.hex : title } }, '星期五', h('br'), '戶外教學'),
        h('p', { class: 'web-lead' }, '請記得帶水壺與帽子，早上 8 點在操場集合。'),
        h('div', { class: 'web-actions' },
          h('span', { class: 'web-btn', style: { background: c.accent.hex, color: onFill(c.accent.hex, c) } }, '查看詳情'),
          h('span', { class: 'web-ghost', style: { borderColor: heroGrad ? g.text.hex : c.primary.hex } }, '行事曆'))),
      h('div', { class: 'web-art', 'aria-hidden': 'true' },
        h('span', { class: 'web-blob', style: { background: g && !heroGrad ? g.css : c.secondary.hex } }),
        h('span', { class: 'web-ring', style: { borderColor: c.primary.hex } }),
        h('span', { class: 'web-dot', style: { background: c.accent.hex } }),
        h('div', { class: 'web-float', style: { background: c.background.hex, color: c.text.hex } },
          h('div', { class: 'web-float-title' }, '作業繳交'),
          h('div', { class: 'web-float-bar' }, h('span', { style: { background: c.primary.hex } })),
          h('div', { class: 'web-float-note' }, '已交 24 / 28')))),
    h('div', { class: 'web-cards' },
      card(c.primary, '作業', '數學習作 P.32'),
      card(c.secondary, '相簿', '校外教學'),
      card(c.accent, '榮譽榜', '閱讀小達人')));
}

function worksheet(c, g) {
  const qs = ['冰塊放在室溫下，會變成什麼狀態？', '水煮沸時冒出的白煙是什麼？', '寫出一個生活中「凝結」的例子。'];
  return h('div', { class: 'mini sheet', 'data-user-color': true, role: 'img', 'aria-label': '迷你學習單預覽', style: { background: c.background.hex, color: c.text.hex } },
    g ? h('div', { class: 'sheet-band', 'aria-hidden': 'true', style: { background: g.css } }) : null,
    h('div', { class: 'slide-kicker' }, '自然科學 學習單'),
    h('div', { class: 'sheet-title', style: { color: titleColor(c) } }, '水的旅行'),
    h('div', { class: 'sheet-meta', style: { borderBottomColor: c.primary.hex } },
      h('span', {}, '班級：＿＿＿'), h('span', {}, '座號：＿＿＿')),
    h('ol', {}, qs.map((q, i) => h('li', {},
      h('span', { class: 'qno', style: { background: c.accent.hex, color: onFill(c.accent.hex, c) } }, String(i + 1)), q))),
    h('table', { class: 'sheet-table' },
      h('thead', {}, h('tr', { style: { background: c.secondary.hex, color: onFill(c.secondary.hex, c) } },
        h('th', {}, '狀態'), h('th', {}, '例子'))),
      h('tbody', {},
        h('tr', {}, h('td', {}, '固態'), h('td', {}, '＿＿＿＿')),
        h('tr', {}, h('td', {}, '氣態'), h('td', {}, '＿＿＿＿')))));
}

const RENDER = { slides: slide, webpage, worksheet };

/**
 * 依類型渲染預覽，並更新面積比例條。
 * @param {{ simulate?: string, gradient?: string|null, scale?: { title: number, body: number } }} [opts]
 *   simulate：none、gray、protan、deutan、tritan；gradient：套用的漸層 key；scale：字級倍率
 */
export function renderPreview(stage, palette, type, ratioEl, { simulate = 'none', gradient = null, scale = null } = {}) {
  const colors = simulateColors(palette.colors, simulate);
  // 漸層用模擬後的顏色重算，黑白與色弱模擬時也看得到漸層的樣子
  const g = gradient ? gradientSuggestions(colors).find((x) => x.key === gradient) ?? null : null;
  const node = (RENDER[type] ?? slide)(colors, g);
  if (scale) {
    node.style.setProperty('--ts', String(scale.title));
    node.style.setProperty('--bs', String(scale.body));
  }
  mount(stage, node);
  if (ratioEl) mount(ratioEl, ratioBar(colors, 'ratio-wide'));
}
