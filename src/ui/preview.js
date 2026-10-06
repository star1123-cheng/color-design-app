// 三種迷你預覽（簡報、班級網頁、學習單）。顏色全部來自推薦結果（使用者資料）。
// 色塊上的字：優先用配色的字色或底色，兩者都未達 4.5:1 時，依 SPEC 4.3 改用黑或白中對比較高者。
// 標題：主色調深到對底色 4.5:1（只調 L，保持 H 與 C），做不到時改用字色。
import { h, mount } from './dom.js';
import { contrastRatio, bestTextOn, adjustForContrast, CONTRAST } from '../color/contrast.js';
import { ratioBar } from './cards.js';
import { simulateColors } from '../color/cvd.js';
import { quantize } from '../color/gamut.js';
import { pickGradients } from '../color/gradient.js';
import { hexToOklch } from '../color/oklch.js';
import { PARTS, isPartValue, resolvePart } from '../data/parts.js';

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

// 漸層（2026-10-06 使用者新增：自選用在哪個元件；2026-10-07 起可同時多個）。g 為 pickGradients 的結果，依 target 找出套在哪裡
const on = (g, target) => g.find((x) => x.target === target) ?? null;
/** 漸層上的字色：可用時用漸層建議的字色，否則取中間色上對比最高的黑或白 */
const textOnGrad = (g) => g.text.hex ?? bestTextOn(g.stops[Math.floor(g.stops.length / 2)].hex).hex;
/** 整頁背景：漸層上的字不夠清楚時保留原字色（漸層建議區會提醒要加底塊） */
const pageStyle = (c, g) => ({ background: g ? g.css : c.background.hex, color: g?.text.hex ?? c.text.hex });
/** 橫幅：字不夠清楚時，字下面墊一塊底色 */
const banner = (c, g, ...children) => h('div', { class: 'grad-banner', style: { background: g.css, color: g.text.hex ?? c.text.hex } },
  g.text.hex ? children : h('div', { class: 'grad-plate', style: { background: c.background.hex } }, children));
/** 小面積色塊：有套漸層時用漸層，否則用原本的角色色 */
const fillStyle = (g, hex, c) => (g ? { background: g.css, color: textOnGrad(g) } : { background: hex, color: onFill(hex, c) });

const deco = (c, g) => h('div', { class: 'deco', 'aria-hidden': 'true' },
  h('span', { class: 'deco-big', 'data-part': 'decoBig', style: { background: g ? g.css : c.primary.hex } }),
  h('span', { class: 'deco-mid', 'data-part': 'decoMid', style: { background: c.secondary.hex } }),
  h('span', { class: 'deco-dot', 'data-part': 'decoDot', style: { background: c.accent.hex } }));

function slide(c, g) {
  const points = ['蒸發：水變成水蒸氣', '凝結：水蒸氣變成小水滴', '降水：小水滴聚集後落下'];
  const [bg, hero, btn] = [on(g, 'background'), on(g, 'hero'), on(g, 'button')];
  const kicker = h('div', { class: btn ? 'slide-kicker is-pill' : 'slide-kicker', 'data-part': 'kicker', style: btn ? fillStyle(btn) : {} }, '自然科學');
  const title = h('div', { class: 'slide-title', 'data-part': 'title', style: { color: hero ? 'inherit' : bg?.text.hex ?? titleColor(c) } }, '水的旅行');
  return h('div', { class: 'mini slide', 'data-user-color': true, 'data-part': 'background', role: 'img', 'aria-label': '迷你簡報預覽', style: pageStyle(c, bg) },
    deco(c, on(g, 'deco')),
    h('div', { class: 'slide-body' },
      hero ? banner(c, hero, kicker, title) : [kicker, title],
      h('ul', { class: 'slide-list', 'data-part': 'body' }, points.map((t) => h('li', {}, t)))),
    h('div', { class: btn ? 'slide-no is-pill' : 'slide-no', 'data-part': 'pageNo', style: btn ? fillStyle(btn) : {} }, '03'));
}

/** 淡色卡片底：沿用角色的色相，明度貼近底色（底色偏深時往亮一點） */
function tint(role, c) {
  const [bgL] = c.background.oklch;
  const [, C, H] = role.oklch;
  return quantize([bgL > 0.6 ? Math.max(0.9, bgL - 0.04) : bgL + 0.1, Math.min(C, 0.045), H]).hex;
}

/** 班級網頁：參考作品集網站的版面（導覽列、雙欄主視覺、淡色卡片），讓配色看起來更有質感 */
function webpage(c, g) {
  const [bg, hero, btn, dec] = [on(g, 'background'), on(g, 'hero'), on(g, 'button'), on(g, 'deco')];
  const title = bg?.text.hex ?? titleColor(c);
  const heroText = hero && (hero.text.hex ?? c.text.hex);
  const card = (role, kicker, name, part) => {
    const bg = tint(role, c);
    return h('div', { class: 'web-card', 'data-part': part, style: { background: bg, color: onFill(bg, c) } },
      h('span', { class: 'web-card-dot', style: { background: role.hex } }),
      h('div', { class: 'web-card-kicker' }, kicker),
      h('div', { class: 'web-card-title' }, name));
  };
  const plate = hero && !hero.text.hex; // 主視覺漸層上字不夠清楚時，文字區墊底色
  return h('div', { class: 'mini web', 'data-user-color': true, 'data-part': 'background', role: 'img', 'aria-label': '迷你班級網頁預覽', style: pageStyle(c, bg) },
    h('div', { class: 'web-nav' },
      h('span', { class: 'web-brand' },
        h('span', { class: 'web-logo', 'data-part': 'logo', style: fillStyle(btn, c.primary.hex, c) }, '5'),
        '五年一班'),
      h('span', { class: 'web-links' }, h('span', {}, '公告'), h('span', {}, '作業'), h('span', {}, '相簿')),
      h('span', { class: 'web-cta', 'data-part': 'cta', style: fillStyle(btn, c.primary.hex, c) }, '聯絡老師')),
    h('div', { class: hero ? 'web-hero is-grad' : 'web-hero', style: hero ? { background: hero.css, color: heroText } : {} },
      h('div', { class: plate ? 'web-copy grad-plate' : 'web-copy', style: plate ? { background: c.background.hex } : {} },
        h('span', { class: 'web-tag', 'data-part': 'tag', style: { borderColor: c.accent.hex } }, '本週公告'),
        h('div', { class: 'web-title', 'data-part': 'title', style: { color: hero ? heroText : title } }, '星期五', h('br'), '戶外教學'),
        h('p', { class: 'web-lead', 'data-part': 'body' }, '請記得帶水壺與帽子，早上 8 點在操場集合。'),
        h('div', { class: 'web-actions' },
          h('span', { class: 'web-btn', 'data-part': 'button', style: fillStyle(btn, c.accent.hex, c) }, '查看詳情'),
          h('span', { class: 'web-ghost', 'data-part': 'ghost', style: { borderColor: hero ? heroText : c.primary.hex } }, '行事曆'))),
      h('div', { class: 'web-art', 'aria-hidden': 'true' },
        h('span', { class: 'web-blob', 'data-part': 'blob', style: { background: dec ? dec.css : c.secondary.hex } }),
        h('span', { class: 'web-ring', 'data-part': 'ring', style: { borderColor: c.primary.hex } }),
        h('span', { class: 'web-dot', 'data-part': 'dot', style: { background: c.accent.hex } }),
        h('div', { class: 'web-float', style: { background: c.background.hex, color: c.text.hex } },
          h('div', { class: 'web-float-title' }, '作業繳交'),
          h('div', { class: 'web-float-bar' }, h('span', { 'data-part': 'progress', style: { background: c.primary.hex } })),
          h('div', { class: 'web-float-note' }, '已交 24 / 28')))),
    h('div', { class: 'web-cards' },
      card(c.primary, '作業', '數學習作 P.32', 'card1'),
      card(c.secondary, '相簿', '校外教學', 'card2'),
      card(c.accent, '榮譽榜', '閱讀小達人', 'card3')));
}

function worksheet(c, g) {
  const qs = ['冰塊放在室溫下，會變成什麼狀態？', '水煮沸時冒出的白煙是什麼？', '寫出一個生活中「凝結」的例子。'];
  const [bg, hero, btn, dec] = [on(g, 'background'), on(g, 'hero'), on(g, 'button'), on(g, 'deco')];
  const kicker = h('div', { class: 'slide-kicker', 'data-part': 'kicker' }, '自然科學 學習單');
  const title = h('div', { class: 'sheet-title', 'data-part': 'title', style: { color: hero ? 'inherit' : bg?.text.hex ?? titleColor(c) } }, '水的旅行');
  return h('div', { class: 'mini sheet', 'data-user-color': true, 'data-part': 'background', role: 'img', 'aria-label': '迷你學習單預覽', style: pageStyle(c, bg) },
    dec ? [h('div', { class: 'sheet-band', 'aria-hidden': 'true', style: { background: dec.css } }),
      h('span', { class: 'sheet-corner', 'aria-hidden': 'true', style: { background: dec.css } })] : null,
    hero ? banner(c, hero, kicker, title) : [kicker, title],
    h('div', { class: 'sheet-meta', 'data-part': 'line', style: { borderBottomColor: c.primary.hex } },
      h('span', {}, '班級：＿＿＿'), h('span', {}, '座號：＿＿＿')),
    h('ol', { 'data-part': 'body' }, qs.map((q, i) => h('li', {},
      h('span', { class: 'qno', 'data-part': 'qno', style: fillStyle(btn, c.accent.hex, c) }, String(i + 1)), q))),
    h('table', { class: 'sheet-table' },
      h('thead', {}, h('tr', { 'data-part': 'thead', style: fillStyle(btn, c.secondary.hex, c) },
        h('th', {}, '狀態'), h('th', {}, '例子'))),
      h('tbody', {},
        h('tr', {}, h('td', {}, '固態'), h('td', {}, '＿＿＿＿')),
        h('tr', {}, h('td', {}, '氣態'), h('td', {}, '＿＿＿＿')))));
}

const RENDER = { slides: slide, webpage, worksheet };

/**
 * 元件配色（2026-10-06 使用者新增）：預覽畫好後，把使用者自訂的顏色套到標了 data-part 的元件。
 * 自訂顏色優先於漸層與預設顏色；色塊上的字自動挑清楚的顏色。
 * @param {HTMLElement} node 預覽根元素
 * @param {Record<string, string>} custom 元件 → 角色名稱或 HEX
 * @param {object} c 模擬後的五色
 * @param {(hex: string) => string} sim 把自訂 HEX 換成模擬後的顏色
 */
function applyCustom(node, custom, c, sim) {
  for (const el of [node, ...node.querySelectorAll('[data-part]')]) {
    const part = el.dataset.part;
    const v = custom[part];
    if (!isPartValue(v)) continue;
    const hex = c[v]?.hex ?? sim(resolvePart(v, c));
    switch (PARTS[part].kind) {
      case 'text': el.style.color = hex; break;
      case 'border': el.style.borderColor = hex; break;
      case 'tint': {
        const bg = tint({ oklch: hexToOklch(hex) }, c);
        Object.assign(el.style, { background: bg, color: onFill(bg, c) });
        const dot = el.querySelector('.web-card-dot');
        if (dot) dot.style.background = hex;
        break;
      }
      default: Object.assign(el.style, { background: hex, color: onFill(hex, c) }); // page、fill
    }
  }
}

/**
 * 依類型渲染預覽，並更新面積比例條。
 * @param {{ simulate?: string, gradient?: { key: string, target: string, dir: string }[]|null, minText?: number, scale?: { title: number, body: number }, custom?: Record<string, string>, picked?: string|null }} [opts]
 *   simulate：none、gray、protan、deutan、tritan；gradient：選用的漸層（每個含 key、用在哪個元件、方向，可多個）；
 *   minText：放字需要的對比度；scale：字級倍率；custom：元件配色；picked：正在調整的元件（加外框提示）
 */
export function renderPreview(stage, palette, type, ratioEl, { simulate = 'none', gradient = null, minText = 4.5, scale = null, custom = {}, picked = null } = {}) {
  const colors = simulateColors(palette.colors, simulate);
  // 漸層用模擬後的顏色重算，黑白與色弱模擬時也看得到漸層的樣子
  const g = pickGradients(colors, gradient, minText);
  const node = (RENDER[type] ?? slide)(colors, g);
  applyCustom(node, custom ?? {}, colors, (hex) => simulateColors({ x: { hex } }, simulate).x.hex);
  if (picked) for (const el of [node, ...node.querySelectorAll('[data-part]')]) el.classList.toggle('is-picked', el.dataset.part === picked);
  if (scale) {
    node.style.setProperty('--ts', String(scale.title));
    node.style.setProperty('--bs', String(scale.body));
  }
  mount(stage, node);
  if (ratioEl) mount(ratioEl, ratioBar(colors, 'ratio-wide'));
}
