// 匯出格式（SPEC 第 6 節）：HEX 清單、RGB、CSS 變數、oklch() 版本、Google 簡報主題色對應。
// 全部從 SPEC 3.1 的配色 JSON 產生，不另存資料。
import { toOklchString, toRgbString } from '../color/oklch.js';
import { oklchToHex } from '../color/gamut.js';
import { adjustForContrast, CONTRAST } from '../color/contrast.js';
import { ROLES } from '../data/schema.js';

export const ROLE_LABELS = { primary: '主色', secondary: '輔色', background: '底色', text: '字色', accent: '點綴色' };

/** HEX 清單（每行「角色 色碼」） */
export const hexList = (p) => ROLES.map((r) => `${ROLE_LABELS[r].padEnd(3, '　')} ${p.colors[r].hex}`).join('\n');

/** RGB 清單 */
export const rgbList = (p) => ROLES.map((r) => `${ROLE_LABELS[r].padEnd(3, '　')} ${toRgbString(p.colors[r].hex)}`).join('\n');

/** CSS 變數（HEX） */
export const cssVariables = (p) =>
  `:root {\n${ROLES.map((r) => `  --color-${r}: ${p.colors[r].hex};`).join('\n')}\n}`;

/** CSS 變數（oklch()，較新瀏覽器；舊瀏覽器請用 HEX 版） */
export const cssOklch = (p) =>
  `:root {\n${ROLES.map((r) => `  --color-${r}: ${toOklchString(p.colors[r].oklch)};`).join('\n')}\n}`;

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

export const slidesThemeText = (p) =>
  slidesTheme(p).map((x) => `${x.field}：${x.hex}（${x.from}）`).join('\n');
