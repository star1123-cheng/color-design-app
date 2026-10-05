// 場景與風格預設（SPEC 4.5、4.6、4.7）
// 字級為（假設）初值；介面微調下限為 0.8 倍（階段 3 實作）
import { STYLE_PREFS, INSUFFICIENT_STYLES } from '../color/rules.js';

export const SCENES = {
  slides: { label: '上課簡報', unit: 'pt', title: 36, body: 20, maxPointsPerSlide: 3, minContrast: 4.5, projection: { title: 40, body: 24 } },
  worksheet: { label: '學習單', unit: 'pt', title: 18, body: 12, maxPointsPerSlide: null, minContrast: 4.5, grayscaleCheck: true },
  webpage: { label: '班級網頁', unit: 'px', title: 32, body: 18, maxPointsPerSlide: null, minContrast: 4.5, lineHeight: 1.6 },
  poster: { label: '公布欄海報', unit: 'pt', title: 72, body: 28, maxPointsPerSlide: 3, minContrast: 7 },
};

export const SCENE_KEYS = Object.keys(SCENES);

/** 投影模式正文對比度（SPEC 4.5） */
export const PROJECTION_MIN_CONTRAST = 7;

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
