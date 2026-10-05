// 程式入口：保存狀態、串接各元件。色彩計算一律呼叫 src/color/，不另寫第二份。
import { recommend } from './color/palette.js';
import { hexToOklch } from './color/oklch.js';
import { initPicker, renderPicker } from './ui/picker.js';
import { renderCards } from './ui/cards.js';
import { renderPreview, renderChecks } from './ui/preview.js';
import { renderRoles } from './ui/roles.js';
import { h, icon, mount } from './ui/dom.js';
import { toast } from './ui/copy.js';
import { TEMPLATES } from './data/templates.js';
import { toPalette, filledRoles, TEMPLATE_STYLES } from './data/template-palette.js';

const $ = (id) => document.getElementById(id);

// 範本庫：只顯示「收錄」的範本（「待決定」由使用者決定後才會收錄）
const TEMPLATE_LIST = TEMPLATES.filter((t) => t.status === '收錄').map((t) => ({ t, palette: toPalette(t) }));
const ALL = '全部';

const state = {
  hex: '#78A5CE',               // 目前選色（SPEC 第 9 節示範色）
  base: hexToOklch('#78A5CE'),  // 明度滑桿以這個顏色的 C、H 為準
  mode: 'public',               // 階段 2 預設大眾模式；老師模式專屬功能在階段 3
  view: 'recs',                 // recs：為你推薦；templates：範本庫（只在大眾模式）
  previewType: 'slides',
  palettes: [],
  selected: 0,
  styleFilter: ALL,
  templateId: TEMPLATE_LIST[0]?.t.id ?? null,
};

const filteredTemplates = () => TEMPLATE_LIST.filter(({ t }) => state.styleFilter === ALL || t.style === state.styleFilter);
const currentTemplate = () => TEMPLATE_LIST.find(({ t }) => t.id === state.templateId) ?? null;
const templateTags = (p) => {
  const { t } = TEMPLATE_LIST.find((x) => x.palette === p);
  return [{ text: t.id }, { text: t.style }, ...(filledRoles(t).length ? [{ text: '含補色', sand: true }] : [])];
};

/** 目前套用中的配色（推薦或範本） */
function activePalette() {
  if (state.view === 'templates' && currentTemplate()) return currentTemplate().palette;
  return state.palettes[state.selected];
}

function renderStyleFilter() {
  const counts = Object.fromEntries(TEMPLATE_STYLES.map((s) => [s, TEMPLATE_LIST.filter(({ t }) => t.style === s).length]));
  const options = [[ALL, TEMPLATE_LIST.length], ...TEMPLATE_STYLES.filter((s) => counts[s] > 0).map((s) => [s, counts[s]])];
  mount($('style-filter'), options.map(([s, n]) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(state.styleFilter === s),
    on: { click: () => { state.styleFilter = s; const first = filteredTemplates()[0]; if (first) applyTemplate(first.t.id); else render(); } },
  }, `${s} ${n}`)));
}

function render() {
  const showTemplates = state.mode === 'public' && state.view === 'templates';
  const palette = activePalette();
  const softened = !showTemplates && palette.checks.warnings.some((w) => w.includes('柔化'));
  renderPicker({ hex: state.hex, softened });

  $('view-switch').hidden = state.mode !== 'public';
  $('style-filter').hidden = !showTemplates;
  $('tpl-hint').hidden = !showTemplates;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === (showTemplates ? 'templates' : 'recs'))));

  if (showTemplates) {
    const list = filteredTemplates();
    $('recs-title').textContent = `範本庫 ${list.length} 組`;
    renderStyleFilter();
    $('cards').classList.add('is-templates');
    renderCards($('cards'), list.map((x) => x.palette), list.findIndex(({ t }) => t.id === state.templateId),
      (i) => applyTemplate(list[i].t.id), { tags: templateTags, showWarnings: false });
  } else {
    $('recs-title').textContent = `為你配好的 ${state.palettes.length} 組`;
    $('cards').classList.remove('is-templates');
    renderCards($('cards'), state.palettes, state.selected, (i) => { state.selected = i; render(); });
  }

  renderPreview($('stage'), palette, state.previewType, $('ratio-wide'));
  renderChecks($('checks'), palette);
  renderRoles($('role-list'), $('copy-all'), $('code'), palette, [$('copy-all-top')]);
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  document.querySelectorAll('[data-preview]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preview === state.previewType)));
  $('mode-hint').hidden = state.mode !== 'teacher';
}

function update({ keepSelection = false } = {}) {
  state.palettes = recommend(state.hex, { mode: state.mode, scene: 'slides' });
  if (!keepSelection || state.selected >= state.palettes.length) state.selected = 0;
  render();
}

/** 套用範本：五個角色與預覽改用範本；主色同步到選色區，推薦也依新主色重算（切回「為你推薦」時一致） */
function applyTemplate(id) {
  const item = TEMPLATE_LIST.find(({ t }) => t.id === id);
  if (!item) return;
  state.templateId = id;
  state.view = 'templates';
  state.hex = item.t.colors.primary;
  state.base = hexToOklch(state.hex);
  update();
}

initPicker({
  getBase: () => state.base,
  onPick: (hex, { rebase }) => {
    if (hex === state.hex && !rebase) return;
    state.hex = hex;
    if (rebase) state.base = hexToOklch(hex);
    state.view = 'recs'; // 自己選色時，回到「為你推薦」
    update();
  },
});

// 模式切換：保留目前選色；範本庫只在大眾模式
document.querySelectorAll('[data-mode]').forEach((btn) => btn.addEventListener('click', () => {
  if (state.mode === btn.dataset.mode) return;
  state.mode = btn.dataset.mode;
  if (state.mode !== 'public') state.view = 'recs';
  update({ keepSelection: true });
}));

document.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => {
  if (btn.dataset.view === 'templates') {
    const first = currentTemplate() ?? filteredTemplates()[0];
    if (first) applyTemplate(first.t.id);
  } else {
    state.view = 'recs';
    render();
  }
}));

document.querySelectorAll('[data-preview]').forEach((btn) => btn.addEventListener('click', () => {
  state.previewType = btn.dataset.preview;
  render();
}));

// 按鈕圖示（data-icon）與尚未開放的功能（data-soon）
document.querySelectorAll('[data-icon]').forEach((el) => el.prepend(icon(el.dataset.icon)));
document.querySelectorAll('[data-soon]').forEach((el) => el.addEventListener('click', (e) => {
  e.preventDefault();
  toast(el.dataset.soon);
}));

// 底部導覽（手機）：推薦、預覽、匯出、收藏（收藏在階段 4）
const NAV = { pick: ['palette', '推薦'], preview: ['eye', '預覽'], roles: ['share', '匯出'], saved: ['bookmark', '收藏'] };
document.querySelectorAll('[data-nav]').forEach((a) => {
  const [ic, label] = NAV[a.dataset.nav];
  mount(a, h('span', { class: 'navicon' }, icon(ic)), h('span', { class: 'navlabel' }, label));
  if (a.getAttribute('aria-disabled') === 'true') {
    a.addEventListener('click', (e) => { e.preventDefault(); toast('收藏功能即將推出'); });
  }
});
if ('IntersectionObserver' in window) {
  const links = [...document.querySelectorAll('[data-nav]:not([aria-disabled])')];
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const id = en.target.id === 'recs' ? 'pick' : en.target.id;
      links.forEach((l) => (l.dataset.nav === id ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  ['pick', 'recs', 'preview', 'roles'].forEach((id) => io.observe($(id)));
}

update();

// 介面自我檢查：網址加上 ?audit=1 時，量測文字對比度、觸控目標、截斷與橫向捲軸（結果印在 Console）
if (new URLSearchParams(location.search).has('audit')) {
  import('./ui/audit-dom.js').then((m) => m.runDomAudit());
}
