// 匯出格式（SPEC 第 6 節）：HEX 清單、RGB、CSS 變數、oklch() 版本、Google 簡報主題色對應。
// 全部從 SPEC 3.1 的配色 JSON 產生，不另存資料。
// 2026-10-06 使用者新增：選定的漸層（g，由 selectedGradient 產生）會附在每種格式後面；沒選時內容與舊版相同。
import { toOklchString, toRgbString } from '../color/oklch.js';
import { pickGradient, GRADIENT_TARGETS, GRADIENT_DIRS } from '../color/gradient.js';
import { minTextContrast } from '../data/presets.js';
import { oklchToHex } from '../color/gamut.js';
import { adjustForContrast, CONTRAST } from '../color/contrast.js';
import { ROLES } from '../data/schema.js';

export const ROLE_LABELS = { primary: '主色', secondary: '輔色', background: '底色', text: '字色', accent: '點綴色' };

/**
 * 選定的漸層（用原始配色計算，不受模擬檢視影響）；放字的對比門檻依配色的場景與投影模式。
 * @param {object} p SPEC 3.1 配色
 * @param {{ key: string|null, target?: string, dir?: string }|null} sel
 */
export function selectedGradient(p, sel) {
  if (!sel?.key) return null;
  const min = minTextContrast(p.context?.scene ?? 'slides', Boolean(p.context?.projection));
  return pickGradient(p.colors, { ...sel, min });
}

/** 漸層的中文說明（名稱、用途、方向、字色），各格式共用 */
export const gradientNote = (g) => `${g.name}，用在${GRADIENT_TARGETS[g.target].label}，${GRADIENT_DIRS[g.dir].desc}`
  + `，${g.text.hex ? `上面的字用 ${g.text.hex}` : '上面放字要先加一塊底色'}`;

const listWithGradient = (lines, g, fmt) => (g
  ? `${lines}\n\n漸層（${gradientNote(g)}）\n${g.stops.map(fmt).join(' → ')}`
  : lines);
const cssWithGradient = (vars, g) => `:root {\n${vars.join('\n')}${g
  ? `\n  /* 漸層：${gradientNote(g)} */\n  --gradient-${g.key}: ${g.css};`
  : ''}\n}`;

/** HEX 清單（每行「角色 色碼」） */
export const hexList = (p, g = null) =>
  listWithGradient(ROLES.map((r) => `${ROLE_LABELS[r].padEnd(3, '　')} ${p.colors[r].hex}`).join('\n'), g, (s) => s.hex);

/** RGB 清單 */
export const rgbList = (p, g = null) =>
  listWithGradient(ROLES.map((r) => `${ROLE_LABELS[r].padEnd(3, '　')} ${toRgbString(p.colors[r].hex)}`).join('\n'), g, (s) => toRgbString(s.hex));

/** CSS 變數（HEX） */
export const cssVariables = (p, g = null) =>
  cssWithGradient(ROLES.map((r) => `  --color-${r}: ${p.colors[r].hex};`), g);

/** CSS 變數（oklch()，較新瀏覽器；舊瀏覽器請用 HEX 版）。漸層沿用 HEX 寫法，相容性較好 */
export const cssOklch = (p, g = null) =>
  cssWithGradient(ROLES.map((r) => `  --color-${r}: ${toOklchString(p.colors[r].oklch)};`), g);

/** 主色或輔色調深到在底色上 ≥ 4.5:1（連結、標題可用）；做不到時改用字色 */
function readable(c, role) {
  const adj = adjustForContrast(c[role].oklch, c.background.hex, CONTRAST.text);
  return adj.ok ? adj.hex : c.text.hex;
}

/**
 * Google 簡報主題色（「主題」→「自訂」的 12 個欄位）對應建議。
 * 深色 2、淺色 2、強調色 4–6 由五色在 OKLCH 只調明度衍生（標示「衍生」）。
 * @returns {{ field: string, hex: string, from: string }[]}
 */
export function slidesTheme(p) {
  const c = p.colors;
  const shade = (role, L) => oklchToHex([L, Math.min(c[role].oklch[1], 0.12), c[role].oklch[2]]);
  return [
    { field: '深色 1（文字）', hex: c.text.hex, from: '字色' },
    { field: '淺色 1（背景）', hex: c.background.hex, from: '底色' },
    { field: '深色 2', hex: readable(c, 'primary'), from: '主色加深（衍生）' },
    { field: '淺色 2', hex: shade('secondary', 0.93), from: '輔色淺色版（衍生）' },
    { field: '強調色 1', hex: c.primary.hex, from: '主色' },
    { field: '強調色 2', hex: c.secondary.hex, from: '輔色' },
    { field: '強調色 3', hex: c.accent.hex, from: '點綴色' },
    { field: '強調色 4', hex: shade('primary', Math.max(0.3, c.primary.oklch[0] - 0.2)), from: '主色深色版（衍生）' },
    { field: '強調色 5', hex: shade('secondary', Math.max(0.3, c.secondary.oklch[0] - 0.2)), from: '輔色深色版（衍生）' },
    { field: '強調色 6', hex: shade('accent', Math.min(0.9, c.accent.oklch[0] + 0.15)), from: '點綴色淺色版（衍生）' },
    { field: '超連結', hex: readable(c, 'primary'), from: '主色加深（衍生）' },
    { field: '已點連結', hex: readable(c, 'secondary'), from: '輔色加深（衍生）' },
  ];
}

/** Google 簡報：主題色沒有漸層欄位，漸層請在「背景」或圖案「填滿顏色」→「漸層」→「自訂」設定 */
export const slidesThemeText = (p, g = null) => {
  const theme = slidesTheme(p).map((x) => `${x.field}：${x.hex}（${x.from}）`).join('\n');
  return g
    ? `${theme}\n\n漸層（${gradientNote(g)}）\n${g.stops.map((s) => s.hex).join(' → ')}\n設定位置：背景或圖案的「填滿顏色」→「漸層」→「自訂」`
    : theme;
};
