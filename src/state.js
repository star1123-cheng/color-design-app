// 介面狀態的變更規則（純函式，不碰 DOM，可在 Node 測試）。
// 每個函式都回傳新的狀態物件，不修改傳入的狀態。
import { hexToOklch, normalizeHex } from './color/oklch.js';
import { SCENES, SCENE_PREVIEW, STYLES, clampTypography } from './data/presets.js';

export const DEFAULT_HEX = '#78A5CE'; // SPEC 第 9 節示範色

export function createState(overrides = {}) {
  const hex = normalizeHex(overrides.hex ?? DEFAULT_HEX);
  return {
    mode: 'public',
    view: 'recs',             // recs：為你推薦；templates：範本庫（只在大眾模式）
    previewType: 'slides',
    simulate: 'none',         // 老師模式的模擬檢視：none、gray、protan、deutan、tritan
    scene: 'slides',          // 老師模式場景
    projection: false,        // 老師模式投影模式
    typo: null,               // 老師模式字級微調（null 表示用場景預設值）
    style: null,              // 大眾模式風格（null 表示不限）
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

/**
 * 切換模式：保留目前選色（hex、base），兩種模式各自的設定（場景、風格）也保留，切回來時還在。
 * 範本庫只在大眾模式，因此切到老師模式時回到「為你推薦」。
 */
export function switchMode(state, mode) {
  if (mode !== 'teacher' && mode !== 'public') return state;
  if (mode === state.mode) return state;
  return {
    ...state,
    mode,
    view: mode === 'teacher' ? 'recs' : state.view,
    simulate: mode === 'teacher' ? state.simulate : 'none',
  };
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

/** 推薦引擎的參數 */
export function recommendOptions(state) {
  return state.mode === 'teacher'
    ? { mode: 'teacher', scene: state.scene, projection: state.projection }
    : { mode: 'public', scene: 'slides', style: state.style };
}

/** 把字級微調寫進配色資料（SPEC 3.1 的 typography），老師模式才套用 */
export function withTypography(palette, state) {
  if (state.mode !== 'teacher') return palette;
  return { ...palette, typography: currentTypography(state) };
}
