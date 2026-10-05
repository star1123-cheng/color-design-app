// 程式入口：保存狀態、串接各元件。色彩計算一律呼叫 src/color/，狀態變更規則在 src/state.js（可測試）。
import { recommend } from './color/palette.js';
import { hexToOklch } from './color/oklch.js';
import { CONTRAST } from './color/contrast.js';
import { minTextContrast } from './data/presets.js';
import { initPicker, renderPicker } from './ui/picker.js';
import { renderCards } from './ui/cards.js';
import { renderPreview, renderChecks } from './ui/preview.js';
import { renderRoles } from './ui/roles.js';
import { renderSceneBar, renderSimSwitch, renderTypography } from './ui/teacher.js';
import { renderStyleChips, renderShareCard } from './ui/public.js';
import { initImagePick } from './ui/image-pick.js';
import { renderExport } from './ui/export.js';
import { renderFavorites } from './ui/favorites.js';
import { loadFavorites, addFavorite, removeFavorite, renameFavorite } from './data/favorites.js';
import { h, icon, mount } from './ui/dom.js';
import { toast } from './ui/copy.js';
import { TEMPLATES } from './data/templates.js';
import { toPalette, filledRoles, TEMPLATE_STYLES } from './data/template-palette.js';
import * as S from './state.js';

const $ = (id) => document.getElementById(id);

// 範本庫：只顯示「收錄」的範本（「待決定」由使用者決定後才會收錄）
const TEMPLATE_LIST = TEMPLATES.filter((t) => t.status === '收錄').map((t) => ({ t, palette: toPalette(t) }));
const ALL = '全部';

// fav：目前套用中的收藏（選色、換卡片、重新推薦時清除）
let state = S.createState({ styleFilter: ALL, templateId: TEMPLATE_LIST[0]?.t.id ?? null, format: 'hex', aiFormat: 'yaml', fav: null });
let palettes = [];
const loaded = loadFavorites();
let favorites = loaded.palettes;
if (loaded.error) setTimeout(() => toast(loaded.error), 300);

const filteredTemplates = () => TEMPLATE_LIST.filter(({ t }) => state.styleFilter === ALL || t.style === state.styleFilter);
const currentTemplate = () => TEMPLATE_LIST.find(({ t }) => t.id === state.templateId) ?? null;
const templateTags = (p) => {
  const { t } = TEMPLATE_LIST.find((x) => x.palette === p);
  return [{ text: t.id }, { text: t.style }, ...(filledRoles(t).length ? [{ text: '含補色', sand: true }] : [])];
};
const showingTemplates = () => state.mode === 'public' && state.view === 'templates';

/** 目前套用中的配色（推薦或範本）；老師模式含字級微調 */
function activePalette() {
  if (state.fav) return state.fav;
  if (showingTemplates() && currentTemplate()) return currentTemplate().palette;
  return S.withTypography(palettes[state.selected], state);
}

/** 更新狀態；recompute 為 true 時重新推薦（並結束套用中的收藏，除非 keepFav） */
function set(next, { recompute = false, keepFav = false } = {}) {
  state = next;
  if (recompute) {
    if (!keepFav) state = { ...state, fav: null };
    palettes = recommend(state.hex, S.recommendOptions(state));
    if (state.selected >= palettes.length) state = { ...state, selected: 0 };
  }
  render();
}

function renderStyleFilter() {
  const counts = Object.fromEntries(TEMPLATE_STYLES.map((s) => [s, TEMPLATE_LIST.filter(({ t }) => t.style === s).length]));
  const options = [[ALL, TEMPLATE_LIST.length], ...TEMPLATE_STYLES.filter((s) => counts[s] > 0).map((s) => [s, counts[s]])];
  mount($('style-filter'), options.map(([s, n]) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(state.styleFilter === s),
    on: {
      click: () => {
        state = { ...state, styleFilter: s };
        const first = filteredTemplates()[0];
        if (first) applyTemplate(first.t.id); else render();
      },
    },
  }, `${s} ${n}`)));
}

function render() {
  const teacher = state.mode === 'teacher';
  const tpl = showingTemplates();
  const palette = activePalette();
  document.body.dataset.mode = state.mode;

  const softened = !tpl && palette.checks.warnings.some((w) => w.includes('柔化'));
  renderPicker({ hex: state.hex, softened });

  // 推薦區上方：老師是場景與投影，大眾是配色來源與風格
  $('teacher-bar').hidden = !teacher;
  $('public-bar').hidden = teacher;
  if (teacher) {
    renderSceneBar($('scene-chips'), $('projection-switch'), state, {
      onScene: (scene) => set(S.setScene(state, scene), { recompute: true }),
      onProjection: (on) => set(S.setProjection(state, on), { recompute: true }),
    });
  } else {
    $('style-block').hidden = tpl;
    if (!tpl) renderStyleChips($('style-chips'), $('style-hint'), state.style, (style) => set(S.setStyle(state, style), { recompute: true }));
  }
  $('style-filter').hidden = !tpl;
  $('tpl-hint').hidden = !tpl;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === (tpl ? 'templates' : 'recs'))));

  if (tpl) {
    const list = filteredTemplates();
    $('recs-title').textContent = `範本庫 ${list.length} 組`;
    renderStyleFilter();
    $('cards').classList.add('is-templates');
    renderCards($('cards'), list.map((x) => x.palette), list.findIndex(({ t }) => t.id === state.templateId),
      (i) => applyTemplate(list[i].t.id), { tags: templateTags, showWarnings: false });
  } else {
    $('recs-title').textContent = `為你配好的 ${palettes.length} 組`;
    $('cards').classList.remove('is-templates');
    renderCards($('cards'), palettes, state.fav ? -1 : state.selected, (i) => set({ ...state, selected: i, fav: null }));
  }

  // 預覽與檢查：老師模式有模擬檢視、字級與版面建議；大眾模式有色票卡
  $('sim-block').hidden = !teacher;
  if (teacher) renderSimSwitch($('sim-chips'), $('sim-hint'), state.simulate, (simulate) => set({ ...state, simulate }));
  renderPreview($('stage'), palette, state.previewType, $('ratio-wide'), teacher ? state.simulate : 'none');
  renderChecks($('checks'), palette, teacher
    ? { teacher: true, minText: minTextContrast(state.scene, state.projection), projection: state.projection }
    : { minText: CONTRAST.text });
  $('typo-panel').hidden = !teacher;
  if (teacher) renderTypography($('typo-panel'), state, (key, delta) => set(S.adjustTypography(state, key, delta)));
  $('share-panel').hidden = teacher;
  if (!teacher) renderShareCard($('share-panel'), palette);

  renderRoles($('role-list'), palette, [$('copy-all-top')]);
  renderExport($('export-panel'), palette, state, {
    onFormat: (format) => set({ ...state, format }),
    onAiFormat: (aiFormat) => set({ ...state, aiFormat }),
  });
  renderFavorites($('fav-list'), $('saved-empty'), favorites, {
    onApply: (p) => {
      set({ ...S.pickColor(state, p.colors.primary.hex), fav: p }, { recompute: true, keepFav: true });
      toast(`已套用收藏「${p.name}」`);
      $('preview').scrollIntoView();
    },
    onRemove: (id) => { const r = removeFavorite(id); favorites = r.palettes; toast(r.message); render(); },
    onRename: (id, name) => { const r = renameFavorite(id, name); favorites = r.palettes; toast(r.message); render(); },
  });
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  document.querySelectorAll('[data-preview]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preview === state.previewType)));
}

/** 套用範本：五個角色與預覽改用範本；主色同步到選色區，推薦也依新主色重算（切回「為你推薦」時一致） */
function applyTemplate(id) {
  const item = TEMPLATE_LIST.find(({ t }) => t.id === id);
  if (!item) return;
  const hex = item.t.colors.primary;
  set({ ...state, templateId: id, view: 'templates', hex, base: hexToOklch(hex), selected: 0 }, { recompute: true });
}

initPicker({
  getBase: () => state.base,
  onPick: (hex, { rebase }) => {
    if (hex === state.hex && !rebase) return;
    set(S.pickColor(state, hex, { rebase }), { recompute: true }); // 自己選色時，回到「為你推薦」
  },
});

initImagePick({
  button: $('image-btn'),
  input: $('image-input'),
  panel: $('extract-panel'),
  onPick: (hex) => {
    set(S.pickColor(state, hex), { recompute: true });
    toast(`已用 ${hex} 當主色`);
  },
});

// 模式切換：保留目前選色（規則見 src/state.js 的 switchMode）
document.querySelectorAll('[data-mode]').forEach((btn) => btn.addEventListener('click', () => {
  set(S.switchMode(state, btn.dataset.mode), { recompute: true });
}));

document.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => {
  if (btn.dataset.view === 'templates') {
    const first = currentTemplate() ?? filteredTemplates()[0];
    if (first) applyTemplate(first.t.id);
  } else {
    set({ ...state, view: 'recs' });
  }
}));

document.querySelectorAll('[data-preview]').forEach((btn) => btn.addEventListener('click', () => {
  set({ ...state, previewType: btn.dataset.preview });
}));

// 按鈕圖示（data-icon）與尚未開放的功能（data-soon）
document.querySelectorAll('[data-icon]').forEach((el) => el.prepend(icon(el.dataset.icon)));
document.querySelectorAll('[data-soon]').forEach((el) => el.addEventListener('click', (e) => {
  e.preventDefault();
  toast(el.dataset.soon);
}));

// 加入收藏（目前套用中的配色，含字級微調）
$('fav-add').addEventListener('click', () => {
  const r = addFavorite(activePalette());
  favorites = r.palettes;
  toast(r.message);
  render();
});

// 底部導覽（手機）：推薦、預覽、匯出、收藏
const NAV = { pick: ['palette', '推薦'], preview: ['eye', '預覽'], roles: ['share', '匯出'], saved: ['bookmark', '收藏'] };
document.querySelectorAll('[data-nav]').forEach((a) => {
  const [ic, label] = NAV[a.dataset.nav];
  mount(a, h('span', { class: 'navicon' }, icon(ic)), h('span', { class: 'navlabel' }, label));
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
  ['pick', 'recs', 'preview', 'roles', 'saved'].forEach((id) => io.observe($(id)));
}

set(state, { recompute: true });

// 離線使用（PWA）：只在安全環境（https 或 localhost）註冊；手機以區網 http 開啟時瀏覽器不支援
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* 註冊失敗不影響一般使用 */ });
}

// 介面自我檢查：網址加上 ?audit=1 時，量測文字對比度、觸控目標、截斷與橫向捲軸（結果印在 Console）
if (new URLSearchParams(location.search).has('audit')) {
  import('./ui/audit-dom.js').then((m) => m.runDomAudit());
}
