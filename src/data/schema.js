// 內部資料格式（SPEC 3.1，schemaVersion 1）與驗證
import { SCENE_KEYS } from './presets.js';
import { GRADIENT_KEYS, GRADIENT_TARGETS, GRADIENT_DIRS } from '../color/gradient.js';
import { isCustomMap } from './parts.js';

export const SCHEMA_VERSION = 1;
export const ROLES = ['primary', 'secondary', 'background', 'text', 'accent'];
export const MODES = ['teacher', 'public'];

const HEX_UPPER_6 = /^#[0-9A-F]{6}$/;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * 驗證一筆配色資料。
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePalette(p) {
  const errors = [];
  if (!isObj(p)) return { valid: false, errors: ['資料不是物件'] };

  if (p.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion 應為 ${SCHEMA_VERSION}`);
  if (typeof p.id !== 'string' || !p.id) errors.push('id 必須是非空字串');
  if (typeof p.name !== 'string') errors.push('name 必須是字串');
  if (!MODES.includes(p.mode)) errors.push('mode 必須是 teacher 或 public');

  if (!isObj(p.context)) errors.push('缺少 context');
  else {
    const { scene, style, projection } = p.context;
    if (scene !== null && !SCENE_KEYS.includes(scene)) errors.push('context.scene 不正確');
    if (style !== null && typeof style !== 'string') errors.push('context.style 必須是字串或 null');
    if (typeof projection !== 'boolean') errors.push('context.projection 必須是布林值');
  }

  if (!isObj(p.colors)) errors.push('缺少 colors');
  else {
    for (const role of ROLES) {
      const c = p.colors[role];
      if (!isObj(c)) { errors.push(`缺少 colors.${role}`); continue; }
      if (!HEX_UPPER_6.test(c.hex ?? '')) errors.push(`colors.${role}.hex 必須是大寫 6 碼 HEX`);
      if (!Array.isArray(c.oklch) || c.oklch.length !== 3 || !c.oklch.every(isNum)) {
        errors.push(`colors.${role}.oklch 必須是 3 個數字`);
      }
    }
  }

  if (!isObj(p.checks)) errors.push('缺少 checks');
  else {
    const { contrast, grayscaleLDiff, cvd, warnings } = p.checks;
    if (!isObj(contrast) || !isNum(contrast.textOnBackground) || !isNum(contrast.accentOnBackground)) {
      errors.push('checks.contrast 的兩個對比度必須是數字');
    }
    if (!isNum(grayscaleLDiff)) errors.push('checks.grayscaleLDiff 必須是數字');
    if (!isObj(cvd) || !['protan', 'deutan', 'tritan'].every((k) => k in cvd && (cvd[k] === null || typeof cvd[k] === 'boolean'))) {
      errors.push('checks.cvd 必須含 protan、deutan、tritan（布林值或 null）');
    }
    if (!Array.isArray(warnings) || !warnings.every((w) => typeof w === 'string')) errors.push('checks.warnings 必須是字串陣列');
  }

  if (!isObj(p.typography)) errors.push('缺少 typography');
  else {
    const t = p.typography;
    if (!['pt', 'px'].includes(t.unit)) errors.push('typography.unit 必須是 pt 或 px');
    if (!isNum(t.title) || !isNum(t.body)) errors.push('typography.title、body 必須是數字');
    if (t.maxPointsPerSlide !== null && !isNum(t.maxPointsPerSlide)) errors.push('typography.maxPointsPerSlide 必須是數字或 null');
  }

  // 選定的漸層（可省略，2026-10-06 使用者新增）：只存 key、用途、方向，色碼由五色重算
  if (p.gradient !== undefined) {
    const g = p.gradient;
    if (!isObj(g) || !GRADIENT_KEYS.includes(g.key) || !Object.hasOwn(GRADIENT_TARGETS, g.target ?? '') || !Object.hasOwn(GRADIENT_DIRS, g.dir ?? '')) {
      errors.push('gradient 必須含正確的 key、target、dir');
    }
  }

  // 元件配色（可省略，2026-10-06 使用者新增）：元件 → 角色名稱或大寫 HEX
  if (p.custom !== undefined && !isCustomMap(p.custom)) errors.push('custom 的元件或顏色不正確');

  return { valid: errors.length === 0, errors };
}

/**
 * 讀取多筆資料（例如收藏）：不認得的 schemaVersion 或格式錯誤者跳過，不讓程式當機。
 * @param {unknown} list
 * @returns {{ palettes: object[], skipped: { index: number, reason: string }[] }}
 */
export function loadPalettes(list) {
  const palettes = [], skipped = [];
  if (!Array.isArray(list)) return { palettes, skipped: [{ index: -1, reason: '資料不是陣列' }] };
  list.forEach((item, index) => {
    if (!isObj(item) || item.schemaVersion !== SCHEMA_VERSION) {
      skipped.push({ index, reason: `不認得的 schemaVersion：${isObj(item) ? item.schemaVersion : '（非物件）'}` });
      return;
    }
    const { valid, errors } = validatePalette(item);
    if (valid) palettes.push(item); else skipped.push({ index, reason: errors.join('；') });
  });
  return { palettes, skipped };
}
