// 產生 docs/palettes.csv：範例色票資料表
// 執行：node scripts/build-palettes.js
//
// 說明：
// - 色碼一律採用圖上印出的值（HEX，或 RGB 數值換算），不從像素取色。
// - 角色、漸層、風格都是依下列規則「推論」；只有圖上直接寫「主色／輔色」者為「已確認」。
// - 依 SPEC 第 2 節第 7 點，本檔只用編號代稱範例，不記錄原始檔名與色名。

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hexToOklch as srcHexToOklch, rgbToHex } from '../src/color/oklch.js';

// ==================== 門檻常數 ====================
// 來自 SPEC 4.2 範圍表（修改 SPEC 時要同步更新這裡）
const BG_L_MIN = 0.89;      // 底色：L 下限（SPEC 暖底 0.89–0.97）
const BG_C_MAX = 0.035;     // 底色：C 上限（SPEC 暖底 0.005–0.035）
const TEXT_L_MAX = 0.50;    // 字色：L 上限（SPEC 0.20–0.50）
const TEXT_C_MAX = 0.065;   // 字色：C 上限（SPEC ≤ 0.065）
const ACCENT_C_MIN = 0.10;  // 點綴色：C 下限（SPEC 0.10–0.14）

// SPEC 沒有規定、本腳本自訂的門檻（假設）
const TEXT_MIN_COLORS = 3;      // 3 色以上才推論字色（2 色組只分主色／輔色／底色）
const GRADIENT_MIN_COLORS = 5;  // 漸層：至少 5 色
const GRADIENT_HUE_SPAN = 40;   // 漸層：彩色部分色相跨度上限（°）；SPEC 4.4 的 6° 是「產生」漸層的規則，不用於辨識範例
const CHROMATIC_C_MIN = 0.02;   // C 高於此值才視為有色相

// 風格推論門檻（SPEC 4.6 只列標籤名稱，沒有數值；以下皆為假設）
const STYLE_DARK_L = 0.45;          // 「深色」的 L 上限
const STYLE_NIGHT_DARK_COUNT = 2;   // 深色 ≥ 2 個 → 夜間
const STYLE_BIZ_L = 0.42;           // 有 L < 此值且低彩度的顏色 → 商務
const STYLE_BIZ_C = 0.06;
const STYLE_FOREST_H = [110, 175];  // 主色色相在此區間 → 森系
const STYLE_FRESH_H = [175, 275];   // 主色色相在此區間 → 清新
const STYLE_RETRO_H = [20, 95];     // 主色色相在此區間、且 L、C 符合下兩行 → 復古
const STYLE_RETRO_L_MAX = 0.75;
const STYLE_RETRO_C_MIN = 0.04;
// 以上都不符合 → 療癒

// 使用者確認後的最終風格（2026-10-05，依 docs/style-review.md）。
// 規則判定信心高者沿用規則結果；信心低者改為畫面觀感的風格（清單列兩個選項時取第一個）。
// 國風、傳統色題材不自動歸為復古；漸層色組一律歸「漸層」，不參與一般風格統計。
const CONFIRMED_STYLES = {
  5: '商務', 7: '商務', 13: '療癒', 18: '復古', 19: '復古', 20: '商務', 22: '清新',
  23: '復古', 26: '復古', 29: '復古', 30: '夜間', 34: '森系', 39: '療癒', 45: '商務',
  46: '復古', 48: '療癒', 50: '森系', 51: '森系', 54: '療癒',
};
const GRADIENT_STYLE = '漸層';

// 資料切分：編號個位數為下列數字者為驗證集，其餘為規則集。
// 既有 01–62 不重新切分；之後新增的圖從 63 號起沿用同一規則。
const VALIDATION_LAST_DIGITS = [3, 6, 9];

// ==================== 範例資料 ====================
// [編號, 標示方式, 色票（依圖上排列順序）, 圖上直接標示的角色（沒有則省略）]
const SAMPLES = [
  [1, 'HEX', ['#D8B4B6', '#F7F2EE', '#A78F88']],
  [2, 'HEX', ['#7FA69A', '#E6DCC8', '#B5C1B0']],
  [3, 'HEX', ['#6FAFD2', '#EFCB5B'], ['主色', '輔色']],
  [4, 'HEX', ['#1C1C1E', '#7E8C78', '#9E6E55']],
  [5, 'HEX', ['#2C6975', '#F6F2EA', '#C56F52']],
  [6, 'HEX', ['#90AFC5', '#D9C9B1', '#F5F1EA', '#8E847A']],
  [7, 'HEX', ['#51697C', '#F2F2EE', '#AAB7C2', '#B79D88']],
  [8, 'HEX', ['#EAF59A', '#CFE85C', '#A9D44A', '#7CB83A', '#5A8E2C']],
  [9, 'HEX', ['#1E2A3E', '#2E4A5E', '#5A8A9E', '#A8C8D8', '#E8F0F6']],
  [10, 'HEX', ['#121F34', '#46657E', '#BAD1D5', '#F6F1EC', '#67AA82']],
  [11, 'HEX', ['#E7688B', '#86CBB0'], ['主色', '輔色']],
  [12, 'HEX', ['#C7A2D9', '#A7C870'], ['主色', '輔色']],
  [13, 'HEX', ['#E88E59', '#6FBFC6'], ['主色', '輔色']],
  [14, 'HEX', ['#E58BA6', '#78C1B6'], ['主色', '輔色']],
  [15, 'HEX', ['#6CB9C9', '#F1C86A'], ['主色', '輔色']],
  [16, 'HEX', ['#C3A2D8', '#B7CE8E'], ['主色', '輔色']],
  [17, 'RGB', [[242, 233, 218], [91, 150, 152]]],
  [18, 'RGB', [[128, 119, 168], [217, 93, 80]]],
  [19, 'RGB', [[217, 179, 95], [123, 91, 75]]],
  [20, 'RGB', [[197, 179, 211], [62, 89, 104]]],
  [21, 'RGB', [[164, 201, 165], [219, 107, 131]]],
  [22, 'RGB', [[244, 223, 168], [90, 164, 174]]],
  [23, 'RGB', [[235, 193, 91], [61, 85, 103]]],
  [24, 'RGB', [[138, 188, 209], [238, 170, 153]]],
  [25, 'RGB', [[107, 146, 116], [216, 206, 139]]],
  [26, 'RGB', [[226, 188, 106], [200, 75, 87]]],
  [27, 'RGB', [[197, 154, 175], [184, 199, 194]]],
  [28, 'RGB', [[111, 175, 196], [232, 226, 209]]],
  [29, 'RGB', [[107, 154, 139], [180, 111, 90]]],
  [30, 'RGB', [[238, 242, 240], [54, 74, 94]]],
  [31, 'HEX', ['#AFCBDA', '#F5F7F6', '#C9D2D5']],
  [32, 'HEX', ['#B9AFD8', '#D7D1DC', '#F2EEEA']],
  [33, 'HEX', ['#F0C4A8', '#EAD8C4', '#F6E2DB']],
  [34, 'HEX', ['#89A8A0', '#F1EFE7', '#D7C5A1']],
  [35, 'HEX', ['#A8C7E8', '#F3E1A0', '#F8F7F1']],
  [36, 'HEX', ['#F7F1E7', '#C8B39A', '#D9D1C8']],
  [37, 'HEX', ['#AABACA', '#F5F1E8', '#D7C8AE']],
  [38, 'HEX', ['#A6B49B', '#F4ECDD', '#D9CDB8']],
  [39, 'HEX', ['#B99275', '#D6CEC4', '#C7A78F']],
  [40, 'HEX', ['#CEE8F3', '#F8F8F4', '#D8DEE3']],
  [41, 'HEX', ['#E8A06E', '#F3E7D5', '#B6A6B8']],
  [42, 'HEX', ['#8DCFC2', '#F6F5F0', '#AFC6DE']],
  [43, 'HEX', ['#141518', '#94A8B7', '#D8C7B4']],
  [44, 'HEX', ['#F7F5F1', '#8FA189', '#C6B8C8']],
  [45, 'HEX', ['#8A8F95', '#B98B8B', '#45606E']],
  [46, 'HEX', ['#2F4D53', '#B7B3AD', '#C89B54']],
  [47, 'HEX', ['#A7B6A1', '#EEE7DC', '#C9C1B5', '#7F7265']],
  [48, 'HEX', ['#8E6F5A', '#F2E6D7', '#B98A5A', '#B1A59A']],
  [49, 'HEX', ['#8D8A87', '#D9B8AD', '#F3EEE8', '#6F625A']],
  [50, 'HEX', ['#556B5F', '#B7B2AA', '#D8D1C3', '#38463F']],
  [51, 'HEX', ['#9FB7B1', '#A78468', '#F5F0E8', '#91857A']],
  [52, 'HEX', ['#211A3E', '#453370', '#A597B6', '#FEF3E8', '#D06C9D']],
  [53, 'HEX', ['#4B1A18', '#AB352B', '#D6904E', '#EAE4E0', '#4982AE']],
  [54, 'HEX', ['#78A5CE', '#FFF0D9', '#DDA4B4', '#7C5549']],
  [55, 'HEX', ['#1E2E22', '#2E4A36', '#4A7C5E', '#8AC0A0', '#D8ECE0']],
  [56, 'HEX', ['#2A1A3E', '#4A2D64', '#7D5B8F', '#B898C4', '#E8E0EC']],
  [57, 'HEX', ['#0E1A2E', '#1E3A5E', '#3A6B8E', '#8EA8CE', '#E0EAF5']],
  [58, 'HEX', ['#0E2A3A', '#1E4A60', '#3A8A9E', '#8EC8D8', '#D8F0F6']],
  [59, 'HEX', ['#9CCBB8', '#BADCCB', '#D2EADB', '#E6F4EE', '#F4FBF8']],
  [60, 'HEX', ['#BCD8A0', '#C8DEB4', '#D6E8CC', '#E2F0DC', '#EEF8EE']],
  [61, 'HEX', ['#A8E0D0', '#BCE8DA', '#D0F0E6', '#E0F6EE', '#F0FAF6']],
  [62, 'HEX', ['#9ED8C0', '#B2E2CE', '#C8ECDE', '#DCF4EC', '#EEF9F5']],
];

// ==================== 色彩換算（共用 src/color/oklch.js） ====================
// 本腳本內部用 { L, C, H } 物件，方便閱讀
export function hexToOklch(hex) {
  const [L, C, H] = srcHexToOklch(hex);
  return { L, C, H };
}

// 涵蓋所有色相的最小弧長（處理 0°／360° 交界）
function hueSpan(hues) {
  if (hues.length < 2) return 0;
  const s = [...hues].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < s.length; i++) {
    const gap = (i === s.length - 1 ? s[0] + 360 : s[i + 1]) - s[i];
    if (gap > maxGap) maxGap = gap;
  }
  return 360 - maxGap;
}

const inRange = (v, [lo, hi]) => v >= lo && v < hi;

// ==================== 推論規則 ====================
// 漸層：色數足夠、依排列順序 L 單調變化、彩色部分色相跨度夠小
export function isGradient(colors) {
  if (colors.length < GRADIENT_MIN_COLORS) return false;
  const diffs = colors.slice(1).map((c, i) => c.L - colors[i].L);
  const monotonic = diffs.every((d) => d > 0) || diffs.every((d) => d < 0);
  const hues = colors.filter((c) => c.C > CHROMATIC_C_MIN).map((c) => c.H);
  return monotonic && hueSpan(hues) <= GRADIENT_HUE_SPAN;
}

// 角色：底色 → 字色 → 主色 → 點綴色 → 其餘為輔色
export function inferRoles(colors) {
  const roles = colors.map(() => null);
  const free = () => colors.map((_, i) => i).filter((i) => !roles[i]);

  const bg = free().filter((i) => colors[i].L >= BG_L_MIN && colors[i].C <= BG_C_MAX);
  if (bg.length) roles[bg.reduce((a, b) => (colors[b].L > colors[a].L ? b : a))] = '底色';

  if (colors.length >= TEXT_MIN_COLORS) {
    const text = free().filter((i) => colors[i].L <= TEXT_L_MAX && colors[i].C <= TEXT_C_MAX);
    if (text.length) roles[text.reduce((a, b) => (colors[b].L < colors[a].L ? b : a))] = '字色';
  }

  const primary = free()[0];
  if (primary !== undefined) roles[primary] = '主色';

  if (colors.length >= TEXT_MIN_COLORS && primary !== undefined) {
    const accent = free().filter((i) => colors[i].C >= ACCENT_C_MIN && colors[i].C > colors[primary].C);
    if (accent.length) roles[accent.reduce((a, b) => (colors[b].C > colors[a].C ? b : a))] = '點綴色';
  }

  return roles.map((r) => r ?? '輔色');
}

// 風格：依序判斷，先符合者為準；同時回傳判斷依據
export function inferStyle(colors, roles, gradient) {
  const darkCount = colors.filter((c) => c.L < STYLE_DARK_L).length;
  if (darkCount >= STYLE_NIGHT_DARK_COUNT) return ['夜間', `深色（L < ${STYLE_DARK_L}）有 ${darkCount} 個`];

  const biz = colors.find((c) => c.L < STYLE_BIZ_L && c.C <= STYLE_BIZ_C);
  if (biz) return ['商務', `含近黑／深色低彩度色（L ${biz.L.toFixed(2)}、C ${biz.C.toFixed(3)}）`];

  const key = gradient ? colors[Math.floor(colors.length / 2)] : colors[roles.indexOf('主色')];
  const keyName = gradient ? '漸層中段' : '主色';
  const desc = `${keyName} L ${key.L.toFixed(2)}、C ${key.C.toFixed(3)}、H ${key.H.toFixed(0)}°`;
  if (key.C > CHROMATIC_C_MIN && inRange(key.H, STYLE_FOREST_H)) return ['森系', `${desc}（綠色區間）`];
  if (key.C > CHROMATIC_C_MIN && inRange(key.H, STYLE_FRESH_H)) return ['清新', `${desc}（青藍區間）`];
  if (inRange(key.H, STYLE_RETRO_H) && key.L < STYLE_RETRO_L_MAX && key.C >= STYLE_RETRO_C_MIN) {
    return ['復古', `${desc}（暖色、偏深、有彩度）`];
  }
  return ['療癒', `${desc}（不符合以上條件）`];
}

export const datasetOf = (no) => (VALIDATION_LAST_DIGITS.includes(no % 10) ? '驗證集' : '規則集');

// ==================== 輸出 ====================
export function buildRows() {
  return SAMPLES.map(([no, source, raw, labeledRoles]) => {
    const hex = source === 'RGB' ? raw.map(rgbToHex) : raw;
    const colors = hex.map(hexToOklch);
    const gradient = isGradient(colors);
    const roles = labeledRoles ?? (gradient ? colors.map((_, i) => `漸層第 ${i + 1} 階`) : inferRoles(colors));
    const [ruleStyle, styleReason] = inferStyle(colors, roles, gradient);
    return {
      no: String(no).padStart(2, '0'),
      dataset: datasetOf(no),
      count: hex.length,
      gradient,
      hex,
      colors,
      roles,
      roleState: labeledRoles ? '已確認' : '推論',
      ruleStyle,
      style: gradient ? GRADIENT_STYLE : (CONFIRMED_STYLES[no] ?? ruleStyle),
      styleReason,
      method: source === 'RGB' ? '標示（RGB 換算）' : '標示',
    };
  });
}

function toCsv(rows) {
  const header = ['編號', '資料集', '色數', '是否漸層', '色票HEX', '角色', '角色狀態', '風格標籤', '風格狀態', '規則推論風格', '取色方式', '取樣信心'];
  const each = (r, v) => r.hex.map(() => v).join(' | ');
  const lines = rows.map((r) => [
    r.no, r.dataset, r.count, r.gradient ? '是' : '否', r.hex.join(' | '), r.roles.join(' | '),
    each(r, r.roleState), r.style, '已確認（使用者）', r.ruleStyle, each(r, r.method), each(r, '—'),
  ]);
  const quote = (v) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  // 加 BOM，讓 Excel 直接開啟時中文不會變亂碼
  return '﻿' + [header, ...lines].map((l) => l.map(quote).join(',')).join('\r\n') + '\r\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = buildRows();
  const out = new URL('../docs/palettes.csv', import.meta.url);
  writeFileSync(out, toCsv(rows), 'utf8');
  const stat = {};
  for (const r of rows) {
    stat[r.style] ??= { 規則集: 0, 驗證集: 0 };
    stat[r.style][r.dataset]++;
  }
  console.log(`已寫入 docs/palettes.csv，共 ${rows.length} 筆`);
  console.log('風格 × 資料集：', JSON.stringify(stat));
  if (process.argv.includes('--verbose')) {
    for (const r of rows) console.log(r.no, r.dataset, r.style, '｜', r.styleReason, '｜', r.hex.map((h, i) => `${h}=${r.roles[i]}`).join(' '));
  }
}
