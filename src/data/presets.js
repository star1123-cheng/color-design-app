// 場景與風格預設（SPEC 4.5、4.6、4.7）
// 字級為（假設）初值；介面微調下限為 0.8 倍（四捨五入到整數）
import { STYLE_PREFS, INSUFFICIENT_STYLES } from '../color/rules.js';
import { CONTRAST } from '../color/contrast.js';

// 對比門檻一律引用 contrast.js 的 CONTRAST（單一來源）
// 海報：SPEC 4.7「遠距離閱讀，對比度採投影標準」
export const SCENES = {
  slides: { label: '上課簡報', unit: 'pt', title: 36, body: 20, maxPointsPerSlide: 3, minContrast: CONTRAST.text, projection: { title: 40, body: 24 } },
  worksheet: { label: '學習單', unit: 'pt', title: 18, body: 12, maxPointsPerSlide: null, minContrast: CONTRAST.text, grayscaleCheck: true },
  webpage: { label: '班級網頁', unit: 'px', title: 32, body: 18, maxPointsPerSlide: null, minContrast: CONTRAST.text, lineHeight: 1.6 },
  poster: { label: '公布欄海報', unit: 'pt', title: 72, body: 28, maxPointsPerSlide: 3, minContrast: CONTRAST.projectionText, farReading: true },
};

/** 預覽類型：海報沒有專屬預覽，以簡報版面代替（假設） */
export const SCENE_PREVIEW = { slides: 'slides', worksheet: 'worksheet', webpage: 'webpage', poster: 'slides' };

/** 字級微調下限比例（SPEC 4.7） */
export const MIN_SIZE_RATIO = 0.8;
/** （假設）字級微調上限比例：SPEC 沒有規定，避免按太多下變得不合理 */
export const MAX_SIZE_RATIO = 2;

export const SCENE_KEYS = Object.keys(SCENES);

/** 投影模式正文對比度（SPEC 4.5） */
export const PROJECTION_MIN_CONTRAST = CONTRAST.projectionText;

/** 風格標籤（SPEC 4.6）；available = false 表示樣本不足、規則建置中 */
export const STYLES = ['清新', '療癒', '復古', '商務', '森系', '夜間'].map((key) => ({
  key,
  available: Boolean(STYLE_PREFS[key]) && !INSUFFICIENT_STYLES.includes(key),
}));

/** 依場景回傳 3.1 格式的 typography */
export function typographyFor(scene, projection = false) {
  const s = SCENES[scene] ?? SCENES.slides;
  const size = projection && s.projection ? s.projection : s;
  return { unit: s.unit, title: size.title, body: size.body, maxPointsPerSlide: s.maxPointsPerSlide };
}

/** 依場景與投影模式回傳正文最低對比度 */
export const minTextContrast = (scene, projection = false) =>
  (projection ? PROJECTION_MIN_CONTRAST : (SCENES[scene] ?? SCENES.slides).minContrast);

/**
 * 字級微調範圍：預設值、下限（預設 × 0.8 四捨五入）、上限（預設 × 2，假設）。
 * 投影模式以投影字級為預設值。
 */
export function typographyLimits(scene, projection = false) {
  const t = typographyFor(scene, projection);
  const lim = (v) => ({ default: v, min: Math.round(v * MIN_SIZE_RATIO), max: Math.round(v * MAX_SIZE_RATIO) });
  return { unit: t.unit, title: lim(t.title), body: lim(t.body) };
}

/** 使用者微調後的字級：夾在範圍內並取整數；沒給的欄位用預設值 */
export function clampTypography(scene, projection, sizes = {}) {
  const lim = typographyLimits(scene, projection);
  const fix = (key) => {
    const v = Number(sizes[key]);
    if (!Number.isFinite(v)) return lim[key].default;
    return Math.min(lim[key].max, Math.max(lim[key].min, Math.round(v)));
  };
  return { ...typographyFor(scene, projection), title: fix('title'), body: fix('body') };
}

/** 版面建議（SPEC 4.7 的「每頁重點上限」與「備註」欄），用簡單的話說明 */
export function layoutTips(scene, projection = false) {
  const s = SCENES[scene] ?? SCENES.slides;
  const tips = [];
  if (s.maxPointsPerSlide) tips.push(`每${scene === 'poster' ? '張' : '頁'}最多 ${s.maxPointsPerSlide} 個重點`);
  if (s.lineHeight) tips.push(`行高建議 ${s.lineHeight}`);
  if (s.grayscaleCheck) tips.push('會印成黑白，預設檢查「黑白列印」');
  if (s.farReading) tips.push(`要從遠處看，字和底色的對比要 ${s.minContrast}:1 以上`);
  if (projection) tips.push(`投影模式：字放大，字和底色的對比要 ${PROJECTION_MIN_CONTRAST}:1 以上`);
  return tips;
}
