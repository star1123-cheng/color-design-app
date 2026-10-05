// 三種迷你預覽（簡報、班級網頁、學習單）與檢查清單。顏色全部來自推薦結果（使用者資料）。
// 色塊上的字：優先用配色的字色或底色，兩者都未達 4.5:1 時，依 SPEC 4.3 改用黑或白中對比較高者。
// 標題：主色調深到對底色 4.5:1（只調 L，保持 H 與 C），做不到時改用字色。
import { h, icon, mount } from './dom.js';
import { contrastRatio, bestTextOn, adjustForContrast, CONTRAST } from '../color/contrast.js';
import { ratioBar } from './cards.js';
import { simulateColors, checkGrayscale, CVD_TYPES, CVD_LABELS, GRAYSCALE_MIN_DIFF } from '../color/cvd.js';
import { checkProjection } from '../color/palette.js';

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

const deco = (c) => h('div', { class: 'deco', 'aria-hidden': 'true' },
  h('span', { class: 'deco-big', style: { background: c.primary.hex } }),
  h('span', { class: 'deco-mid', style: { background: c.secondary.hex } }),
  h('span', { class: 'deco-dot', style: { background: c.accent.hex } }));

function slide(c) {
  const points = ['蒸發：水變成水蒸氣', '凝結：水蒸氣變成小水滴', '降水：小水滴聚集後落下'];
  return h('div', { class: 'mini slide', 'data-user-color': true, role: 'img', 'aria-label': '迷你簡報預覽', style: { background: c.background.hex, color: c.text.hex } },
    deco(c),
    h('div', { class: 'slide-body' },
      h('div', { class: 'slide-kicker' }, '自然科學'),
      h('div', { class: 'slide-title', style: { color: titleColor(c) } }, '水的旅行'),
      h('ul', { class: 'slide-list' }, points.map((t) => h('li', {}, t)))),
    h('div', { class: 'slide-no' }, '03'));
}

function webpage(c) {
  return h('div', { class: 'mini web', 'data-user-color': true, role: 'img', 'aria-label': '迷你班級網頁預覽', style: { background: c.background.hex, color: c.text.hex } },
    h('div', { class: 'web-head', style: { background: c.primary.hex, color: onFill(c.primary.hex, c) } },
      h('span', {}, '五年一班'),
      h('span', { class: 'web-nav' }, h('span', {}, '公告'), h('span', {}, '作業'), h('span', {}, '相簿'))),
    h('div', { class: 'web-body' },
      h('div', { class: 'web-hero', style: { background: c.secondary.hex, color: onFill(c.secondary.hex, c) } },
        h('div', { class: 'web-title' }, '本週公告'),
        h('div', {}, '星期五戶外教學，請記得帶水壺與帽子。'),
        h('span', { class: 'web-btn', style: { background: c.accent.hex, color: onFill(c.accent.hex, c) } }, '查看詳情')),
      h('div', { class: 'web-row' },
        h('div', { class: 'web-tile', style: { borderColor: c.secondary.hex } }, '作業繳交'),
        h('div', { class: 'web-tile', style: { borderColor: c.secondary.hex } }, '班級相簿'))));
}

function worksheet(c) {
  const qs = ['冰塊放在室溫下，會變成什麼狀態？', '水煮沸時冒出的白煙是什麼？', '寫出一個生活中「凝結」的例子。'];
  return h('div', { class: 'mini sheet', 'data-user-color': true, role: 'img', 'aria-label': '迷你學習單預覽', style: { background: c.background.hex, color: c.text.hex } },
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
 * @param {string} [simulate] 模擬檢視（老師模式）：none、gray、protan、deutan、tritan
 */
export function renderPreview(stage, palette, type, ratioEl, simulate = 'none') {
  const colors = simulateColors(palette.colors, simulate);
  mount(stage, (RENDER[type] ?? slide)(colors));
  if (ratioEl) mount(ratioEl, ratioBar(colors, 'ratio-wide'));
}

const ratioText = (v) => `${v.toFixed(1)}:1`;

/** 大眾模式：文字對比度、點綴色對比度（SPEC 4.3） */
function publicRows(palette) {
  const { textOnBackground, accentOnBackground } = palette.checks.contrast;
  return [
    { title: '文字對比度', desc: `字色對底色，一般文字需 ${CONTRAST.text}:1 以上`, value: ratioText(textOnBackground), ok: textOnBackground >= CONTRAST.text },
    { title: '點綴色對比度', desc: `按鈕邊框、圖表線條需 ${CONTRAST.graphic}:1 以上`, value: ratioText(accentOnBackground), ok: accentOnBackground >= CONTRAST.graphic },
  ];
}

/** 老師模式：用簡單的話說明（SPEC 4.5、7） */
function teacherRows(palette, { minText, projection }) {
  const { contrast, cvd } = palette.checks;
  const gray = checkGrayscale(palette.colors.primary.hex, palette.colors.secondary.hex); // 不用四捨五入後的值判斷
  const rows = [
    { title: '字看得清楚嗎', desc: `字和底色的對比要 ${minText}:1 以上`, value: ratioText(contrast.textOnBackground), ok: contrast.textOnBackground >= minText },
    { title: '重點色看得清楚嗎', desc: `點綴色當按鈕框線、圖表線條，對比要 ${CONTRAST.graphic}:1 以上`, value: ratioText(contrast.accentOnBackground), ok: contrast.accentOnBackground >= CONTRAST.graphic },
    { title: '印成黑白分得出來嗎', desc: `主色和輔色印成黑白後，深淺要差 ${GRAYSCALE_MIN_DIFF} 以上`, value: gray.diff.toFixed(2), ok: gray.ok },
  ];
  if (projection) {
    const pj = checkProjection(palette);
    rows.push({ title: '適合投影嗎', desc: pj.ok ? '底色夠亮、字夠清楚、大面積的顏色不刺眼' : pj.issues.join('、'), value: pj.ok ? '適合' : '要調整', ok: pj.ok });
  }
  for (const t of CVD_TYPES) {
    rows.push({ title: `${CVD_LABELS[t]}的人分得出來嗎`, desc: `模擬${CVD_LABELS[t]}的人看主色和輔色`, value: cvd[t] ? '分得出' : '不易分辨', ok: cvd[t] === true });
  }
  return rows;
}

/**
 * 檢查清單。
 * @param {{ teacher?: boolean, minText?: number, projection?: boolean }} [opts]
 */
export function renderChecks(list, palette, { teacher = false, minText = CONTRAST.text, projection = false } = {}) {
  const rows = teacher ? teacherRows(palette, { minText, projection }) : publicRows(palette);
  mount(list, rows.map((r) => h('li', { class: 'check' },
    h('span', { class: r.ok ? 'check-icon' : 'check-icon check-icon-warn' }, icon(r.ok ? 'check' : 'alert')),
    h('div', { class: 'check-text' },
      h('div', { class: 'check-title' }, r.title, h('span', { class: 'visually-hidden' }, r.ok ? '：通過' : '：未通過')),
      h('div', { class: 'check-desc' }, r.desc)),
    h('span', { class: 'check-value' }, r.value))));
}
