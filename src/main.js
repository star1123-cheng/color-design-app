// 程式入口：保存狀態、串接各元件。色彩計算一律呼叫 src/color/，狀態變更規則在 src/state.js（可測試）。
import { recommend } from './color/palette.js';
import { hexToOklch } from './color/oklch.js';
import { minTextContrast } from './data/presets.js';
import { initPicker, renderPicker } from './ui/picker.js';
import { renderCards } from './ui/cards.js';
import { renderPreview } from './ui/preview.js';
import { renderGradients } from './ui/gradient.js';
import { gradientTargetsFor, DEFAULT_GRADIENT_TARGET } from './color/gradient.js';
import { renderCustom } from './ui/custom.js';
import { renderWebPalettes, webToPalette, ALL_SERIES } from './ui/web-palettes.js';
import { PARTS, partsFor } from './data/parts.js';
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
const showingTemplates = () => state.view === 'templates';

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
  const tpl = showingTemplates();
  const palette = activePalette();

  const softened = !tpl && palette.checks.warnings.some((w) => w.includes('柔化'));
  renderPicker({ hex: state.hex, softened });

  // 推薦區上方：場景與投影、配色來源與風格
  renderSceneBar($('scene-chips'), $('projection-switch'), state, {
    onScene: (scene) => set(S.setScene(state, scene), { recompute: true }),
    onProjection: (on) => set(S.setProjection(state, on), { recompute: true }),
  });
  $('style-block').hidden = tpl;
  if (!tpl) renderStyleChips($('style-chips'), $('style-hint'), state.style, (style) => set(S.setStyle(state, style), { recompute: true }));
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

  // 預覽：模擬檢視、漸層、字級與版面建議（預覽的字會跟著字級變大變小）、色票卡
  // 2026-10-06 使用者決定：拿掉預覽下方的檢查清單
  const minText = minTextContrast(state.scene, state.projection);
  renderSimSwitch($('sim-chips'), $('sim-hint'), state.simulate, (simulate) => set({ ...state, simulate }));
  const grad = S.gradientSelections(state);
  const part = partsFor(state.previewType).includes(state.customPart) ? state.customPart : 'title';
  renderPreview($('stage'), palette, state.previewType, $('ratio-wide'),
    { simulate: state.simulate, gradient: grad, minText, scale: S.typographyScale(state), custom: state.custom, picked: part });
  renderCustom($('custom-panel'), palette, state.previewType, { custom: state.custom, part }, minText, {
    onPart: pickPart,
    onSet: (p, v) => set(S.setPartColor(state, p, v)),
    onReset: () => { set(S.resetCustom(state)); toast('元件配色已全部回到預設'); },
  });
  // 漸層的元件不在目前的預覽時，改成設定標題（與元件配色相同的做法）
  const gst = gradientTargetsFor(state.previewType).includes(state.gradientTarget) ? state : S.setGradientTarget(state, DEFAULT_GRADIENT_TARGET);
  renderGradients($('gradient-panel'), palette, { list: grad, target: gst.gradientTarget, dir: gst.gradientDir, type: state.previewType }, minText, {
    onApply: (key) => {
      const next = S.toggleGradient(gst, key);
      set(next);
      if (S.gradientAt(next)) $('stage').scrollIntoView({ block: 'center' });
    },
    onRemove: (target) => set(S.removeGradient(state, target)),
    onTarget: (target) => set(S.setGradientTarget(state, target)),
    onDir: (dir) => set(S.setGradientDir(gst, dir)),
  });
  renderTypography($('typo-panel'), state, {
    onAdjust: (key, delta) => set(S.adjustTypography(state, key, delta)),
    onReset: () => set(S.resetTypography(state)),
  });
  renderShareCard($('share-panel'), palette);

  renderRoles($('role-list'), palette, [$('copy-all-top')]);
  renderExport($('export-panel'), palette, { ...state, gradients: grad, custom: state.custom }, {
    onFormat: (format) => set({ ...state, format }),
    onAiFormat: (aiFormat) => set({ ...state, aiFormat }),
  });
  renderFavorites($('fav-list'), $('saved-empty'), favorites, {
    onApply: (p) => {
      set(S.applyFavorite({ ...S.pickColor(state, p.colors.primary.hex), fav: p }, p), { recompute: true, keepFav: true });
      toast(`已套用收藏「${p.name}」`);
      goTo('preview');
    },
    onRemove: (id) => { const r = removeFavorite(id); favorites = r.palettes; toast(r.message); render(); },
    onRename: (id, name) => { const r = renameFavorite(id, name); favorites = r.palettes; toast(r.message); render(); },
  });
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

/** 選一個元件來調整；元件不在目前的預覽時，切到有它的預覽 */
function pickPart(p) {
  if (!PARTS[p]) return;
  const previewType = PARTS[p].types.includes(state.previewType) ? state.previewType : PARTS[p].types[0];
  set({ ...state, customPart: p, previewType });
}

// 點預覽上的元件：選它來調整顏色（最內層、有標 data-part 的元素）
$('stage').addEventListener('click', (e) => {
  const el = e.target.closest('[data-part]');
  if (!el) return;
  pickPart(el.dataset.part);
  $('custom-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

// 加入收藏（目前套用中的配色，含字級微調、選定的漸層與元件配色）
$('fav-add').addEventListener('click', () => {
  const r = addFavorite(S.paletteForFavorite(activePalette(), state));
  favorites = r.palettes;
  toast(r.message);
  render();
});

// 網路推薦配色：不隨配色變動，只在換系列時重畫
let webSeries = ALL_SERIES;
function renderWeb() {
  renderWebPalettes($('webpal-filter'), $('webpal-list'), $('webpal-count'), webSeries, {
    onSeries: (series) => { webSeries = series; renderWeb(); },
    // 整組套用到預覽（2026-10-06 使用者決定）：與套用收藏相同，選色區同步成這組的主色，推薦卡片不選取
    onUse: (p) => {
      const palette = webToPalette(p, minTextContrast(state.scene, state.projection));
      set(S.applyFavorite({ ...S.pickColor(state, palette.colors.primary.hex), fav: palette }, palette), { recompute: true, keepFav: true });
      toast(`已把「${p.name}」整組套用到預覽`);
      goTo('preview');
    },
  });
}
renderWeb();

// 手機分頁（2026-10-06 使用者決定）：底部選單切換頁面，不再一路往下捲。
// 每個區塊用 data-page 標示屬於哪一頁，CSS 依 body 的 data-page 只顯示那一頁；電腦版（≥ 1024 px）全部顯示。
const NAV = { pick: ['palette', '推薦'], preview: ['eye', '預覽'], roles: ['share', '匯出'], web: ['pie', '網路配色'], saved: ['bookmark', '收藏'] };
const PAGE_HASH = { pick: 'pick', preview: 'preview', roles: 'roles', web: 'webpal', saved: 'saved' };
const HASH_PAGE = { ...Object.fromEntries(Object.entries(PAGE_HASH).map(([p, id]) => [id, p])), recs: 'pick' };
const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

/** 顯示某一頁（手機）；push 為 true 時記進瀏覽紀錄，按「上一頁」可以回來 */
function showPage(page, { push = false } = {}) {
  const p = NAV[page] ? page : 'pick';
  document.body.dataset.page = p;
  document.querySelectorAll('[data-nav]').forEach((a) => (a.dataset.nav === p ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (push) history.pushState({ page: p }, '', `#${PAGE_HASH[p]}`);
  if (!isDesktop()) window.scrollTo(0, 0);
}

/** 前往某個區塊：手機切換頁面，電腦版捲動到該區塊 */
function goTo(page, id = PAGE_HASH[page]) {
  if (isDesktop()) $(id).scrollIntoView();
  else showPage(page, { push: true });
}

document.querySelectorAll('[data-nav]').forEach((a) => {
  const [ic, label] = NAV[a.dataset.nav];
  mount(a, h('span', { class: 'navicon' }, icon(ic)), h('span', { class: 'navlabel' }, label));
  a.addEventListener('click', (e) => {
    e.preventDefault();
    showPage(a.dataset.nav, { push: document.body.dataset.page !== a.dataset.nav });
  });
});
window.addEventListener('popstate', () => showPage(HASH_PAGE[location.hash.slice(1)] ?? 'pick'));
showPage(HASH_PAGE[location.hash.slice(1)] ?? 'pick');

set(state, { recompute: true });

// 離線使用（PWA）：只在安全環境（https 或 localhost）註冊；手機以區網 http 開啟時瀏覽器不支援
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* 註冊失敗不影響一般使用 */ });
}

// 啟動畫面：播完（淡出結束）就移除；網址加上 ?splash=1 可在一般瀏覽器預覽
const splash = $('splash');
if (new URLSearchParams(location.search).has('splash')) document.documentElement.classList.add('splash-preview');
splash?.addEventListener('animationend', (e) => { if (e.target === splash) splash.remove(); });
if (splash && getComputedStyle(splash).display === 'none') splash.remove();

// 介面自我檢查：網址加上 ?audit=1 時，量測文字對比度、觸控目標、截斷與橫向捲軸（結果印在 Console）
if (new URLSearchParams(location.search).has('audit')) {
  import('./ui/audit-dom.js').then((m) => m.runDomAudit());
}
