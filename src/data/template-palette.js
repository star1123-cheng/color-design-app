// 範本 → SPEC 3.1 配色格式，以及範本的檢查。
// 產生腳本（scripts/build-templates.js）、網頁與測試共用這一份，不另寫第二份。
import { hexToOklch } from '../color/oklch.js';
import { contrastRatio, CONTRAST } from '../color/contrast.js';
import { checkPalette } from '../color/rules.js';
import { SCHEMA_VERSION, ROLES, validatePalette } from './schema.js';
import { typographyFor } from './presets.js';

export const ROLE_LABELS = { primary: '主色', secondary: '輔色', background: '底色', text: '字色', accent: '點綴色' };
export const TEMPLATE_STYLES = ['清新', '療癒', '復古', '商務', '森系', '夜間']; // SPEC 4.6
export const SOURCE_SAMPLE = '範例';
export const SOURCE_ENGINE = '引擎補色';

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const lch = (hex) => { const [L, C, H] = hexToOklch(hex); return [round(L, 3), round(C, 3), round(H, 1) % 360]; };

/** 由引擎補色的角色（中文名稱） */
export const filledRoles = (t) => ROLES.filter((r) => t.source[r] === SOURCE_ENGINE).map((r) => ROLE_LABELS[r]);

/** 範本 → SPEC 3.1 配色物件 */
export function toPalette(t) {
  const colors = Object.fromEntries(ROLES.map((r) => [r, { hex: t.colors[r], oklch: lch(t.colors[r]) }]));
  const filled = filledRoles(t);
  return {
    schemaVersion: SCHEMA_VERSION,
    id: t.id,
    name: t.id,
    mode: 'public',
    context: { scene: null, style: t.style, projection: false },
    colors,
    checks: {
      contrast: {
        textOnBackground: round(contrastRatio(t.colors.text, t.colors.background), 2),
        accentOnBackground: round(contrastRatio(t.colors.accent, t.colors.background), 2),
      },
      grayscaleLDiff: round(Math.abs(colors.primary.oklch[0] - colors.secondary.oklch[0]), 3),
      cvd: { protan: null, deutan: null, tritan: null },
      warnings: [
        ...(filled.length ? [`含引擎補色：${filled.join('、')}`] : []),
        ...t.issues,
      ],
    },
    typography: typographyFor('slides'),
  };
}

/**
 * 檢查範本，回傳未通過原因（不改色）。
 * - 必要：通過 validatePalette（SPEC 3.1 格式）。
 * - 品質：字色對底色 ≥ 4.5:1、點綴色對底色 ≥ 3:1（SPEC 4.3）。
 * - 參考：SPEC 4.2 範圍（範例本來就常超出範圍，只記錄，不影響收錄）。
 * @returns {{ blocking: string[], info: string[] }}
 */
export function checkTemplate(t) {
  const blocking = [];
  const info = [];
  const p = toPalette({ ...t, issues: [] });
  const { valid, errors } = validatePalette(p);
  if (!valid) blocking.push(`資料格式不符：${errors.join('；')}`);
  const { textOnBackground: tb, accentOnBackground: ab } = p.checks.contrast;
  if (tb < CONTRAST.text) blocking.push(`字色對底色 ${tb.toFixed(2)}:1，未達 ${CONTRAST.text}:1`);
  if (ab < CONTRAST.graphic) blocking.push(`點綴色對底色 ${ab.toFixed(2)}:1，未達 ${CONTRAST.graphic}:1`);
  const range = checkPalette(Object.fromEntries(ROLES.map((r) => [r, p.colors[r].oklch])));
  const outOfRange = ROLES.filter((r) => !range[r].ok).map((r) => ROLE_LABELS[r]);
  if (outOfRange.length) info.push(`超出 SPEC 4.2 範圍（參考）：${outOfRange.join('、')}`);
  return { blocking, info };
}
