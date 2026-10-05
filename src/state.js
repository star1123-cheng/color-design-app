// 介面狀態的變更規則（純函式，不碰 DOM，可在 Node 測試）。
// 每個函式都回傳新的狀態物件，不修改傳入的狀態。
// 2026-10-05 使用者決定：不再分老師／大眾模式，場景、投影、風格、模擬檢視等功能全部整合在同一個畫面。
import { hexToOklch, normalizeHex } from './color/oklch.js';
import { SCENES, SCENE_PREVIEW, STYLES, clampTypography, typographyLimits } from './data/presets.js';
import { PARTS, isPartValue } from './data/parts.js';

export const DEFAULT_HEX = '#78A5CE'; // SPEC 第 9 節示範色

export function createState(overrides = {}) {
  const hex = normalizeHex(overrides.hex ?? DEFAULT_HEX);
  return {
    view: 'recs',             // recs：為你推薦；templates：範本庫
    previewType: 'slides',
    simulate: 'none',         // 模擬檢視：none、gray、protan、deutan、tritan
    scene: 'slides',          // 使用場景
    projection: false,        // 投影模式
    typo: null,               // 字級微調（null 表示用場景預設值）
    style: null,              // 風格（null 表示不限）
    gradient: null,           // 選定的漸層（null 表示不用漸層），會套用到預覽並放進匯出
    gradientTarget: 'hero',   // 漸層用在哪個元件：background、hero、button、deco
    gradientDir: 'diag',      // 漸層方向：diag、h、v、radial
    custom: {},               // 元件配色：元件 → 角色名稱或 HEX（見 src/data/parts.js）
    customPart: 'title',      // 正在調整的元件
    selected: 0,
    ...overrides,
    hex,                                          // 目前選色（大寫 6 碼）
    base: overrides.base ?? hexToOklch(hex),      // 明度滑桿以這個顏色的 C、H 為準
  };
}

/** 選色：base 只在「換了一個新顏色」時更新（明度滑桿只改 L，不換 base） */
export function pickColor(state, hex, { rebase = true } = {}) {
  const h = normalizeHex(hex);
  return { ...state, hex: h, base: rebase ? hexToOklch(h) : state.base, view: 'recs', selected: 0 };
}

/** 換場景：預覽改成對應版面；學習單預設開啟黑白列印檢查（SPEC 4.7）；字級回到預設 */
export function setScene(state, scene) {
  if (!SCENES[scene]) return state;
  return {
    ...state,
    scene,
    typo: null,
    selected: 0,
    previewType: SCENE_PREVIEW[scene],
    simulate: SCENES[scene].grayscaleCheck ? 'gray' : 'none',
  };
}

/** 投影模式開關：字級預設值不同，所以微調回到預設 */
export const setProjection = (state, on) => ({ ...state, projection: Boolean(on), typo: null, selected: 0 });

/** 設定風格：只接受規則已建置的風格；null 表示不限 */
export function setStyle(state, style) {
  if (style !== null && !STYLES.some((s) => s.key === style && s.available)) return state;
  return { ...state, style, view: 'recs', selected: 0 };
}

/** 目前的字級（含微調），已夾在下限與上限之間 */
export const currentTypography = (state) => clampTypography(state.scene, state.projection, state.typo ?? {});

/** 字級微調：key 為 title 或 body，delta 為加減的點數 */
export function adjustTypography(state, key, delta) {
  const now = currentTypography(state);
  const next = clampTypography(state.scene, state.projection, { ...now, [key]: now[key] + delta });
  return { ...state, typo: { title: next.title, body: next.body } };
}

/** 字級微調後相對於預設值的倍率，讓預覽的字跟著變大變小 */
export function typographyScale(state) {
  const t = currentTypography(state);
  const lim = typographyLimits(state.scene, state.projection);
  return { title: t.title / lim.title.default, body: t.body / lim.body.default };
}

/** 字級回到場景預設值 */
export const resetTypography = (state) => ({ ...state, typo: null });

/** 推薦引擎的參數：場景、投影與風格一起使用（資料格式的 mode 固定為 teacher，因為含場景） */
export const recommendOptions = (state) =>
  ({ mode: 'teacher', scene: state.scene, projection: state.projection, style: state.style });

/** 把字級微調寫進配色資料（SPEC 3.1 的 typography） */
export const withTypography = (palette, state) => ({ ...palette, typography: currentTypography(state) });

/** 設定某個元件的顏色：value 為角色名稱或 HEX（大小寫皆可）；null 表示回到預設 */
export function setPartColor(state, part, value) {
  if (!Object.hasOwn(PARTS, part)) return state;
  const { [part]: _old, ...rest } = state.custom ?? {};
  if (value === null) return { ...state, custom: rest, customPart: part };
  const v = typeof value === 'string' && value.startsWith('#') ? value.toUpperCase() : value;
  if (!isPartValue(v)) return state;
  return { ...state, custom: { ...rest, [part]: v }, customPart: part };
}

/** 元件配色全部回到預設 */
export const resetCustom = (state) => ({ ...state, custom: {} });

/** 收藏用：把目前選定的漸層與元件配色寫進配色（沒有設定時不寫這兩個欄位） */
export function paletteForFavorite(palette, state) {
  const { gradient: _g, custom: _c, ...rest } = palette;
  const sel = gradientSelection(state);
  const custom = state.custom ?? {};
  return {
    ...rest,
    ...(sel.key ? { gradient: sel } : {}),
    ...(Object.keys(custom).length ? { custom: { ...custom } } : {}),
  };
}

/** 套用收藏：漸層與元件配色跟著收藏（收藏沒有時取消；漸層的用途與方向維持目前的選擇） */
export const applyFavorite = (state, fav) => ({
  ...state,
  gradient: fav.gradient?.key ?? null,
  gradientTarget: fav.gradient?.target ?? state.gradientTarget,
  gradientDir: fav.gradient?.dir ?? state.gradientDir,
  custom: { ...(fav.custom ?? {}) },
});

/** 目前選定的漸層設定（給預覽與匯出共用） */
export const gradientSelection = (state) =>
  ({ key: state.gradient ?? null, target: state.gradientTarget ?? 'hero', dir: state.gradientDir ?? 'diag' });
