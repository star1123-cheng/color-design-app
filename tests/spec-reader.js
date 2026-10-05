// 從 SPEC.md 讀取規則數值，作為測試的預期值。
// 目的：預期值來自 SPEC 原文，而不是從 src/color/rules.js 複製，避免循環驗證。
// 本檔不是測試檔（檔名不符合 node --test 的搜尋規則），只供測試匯入。
import { readFileSync } from 'node:fs';

const SPEC = readFileSync(new URL('../SPEC.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** 取出某一節（例如 '4.2'）到下一個同級或上級標題之前的文字 */
export function section(id) {
  const lines = SPEC.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^#{2,3} ${id.replace('.', '\\.')}[ （]`).test(l));
  if (start < 0) throw new Error(`SPEC.md 找不到第 ${id} 節`);
  const end = lines.findIndex((l, i) => i > start && /^#{2,3} /.test(l));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

/** 取出某一節表格中，第一欄等於 label 的那一列（回傳各欄文字） */
export function row(sectionText, label) {
  const line = sectionText.split('\n').map((l) => l.trim())
    .find((l) => l.startsWith('|') && l.split('|')[1]?.trim() === label);
  if (!line) throw new Error(`表格中找不到「${label}」這一列`);
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

const num = (s) => Number(s);

/** 「0.48–0.83」→ [0.48, 0.83] */
export function range(cell) {
  const m = /([\d.]+)\s*–\s*([\d.]+)/.exec(cell);
  if (!m) throw new Error(`無法解析範圍：${cell}`);
  return [num(m[1]), num(m[2])];
}

/** 「≤ 0.04」→ 0.04 */
export function le(cell) {
  const m = /≤\s*([\d.]+)/.exec(cell);
  if (!m) throw new Error(`無法解析上限：${cell}`);
  return num(m[1]);
}

/** 「≥ 0.25」→ 0.25 */
export function ge(cell) {
  const m = /≥\s*([\d.]+)/.exec(cell);
  if (!m) throw new Error(`無法解析下限：${cell}`);
  return num(m[1]);
}

/** 「4.5:1」→ 4.5 */
export function ratio(cell) {
  const m = /([\d.]+):1/.exec(cell);
  if (!m) throw new Error(`無法解析對比度：${cell}`);
  return num(m[1]);
}

/** 色相偏好「290–60°」→ [[290, 360], [0, 60]]（跨 0° 時拆成兩段） */
export function hueWindows(cell) {
  const [a, b] = range(cell);
  return a > b ? [[a, 360], [0, b]] : [[a, b]];
}

export const specText = SPEC;
