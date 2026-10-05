// 瀏覽器內的介面自我檢查（不需安裝截圖工具）
// 用法：網址加 ?audit=1，例如 http://localhost:8080/?audit=1，結果印在開發者工具的 Console，
//       並存到 window.__audit 方便檢查。
// 檢查項目：
// 1. 介面自身文字對比度 ≥ 4.5:1（SPEC 7、階段 2）。推薦色與預覽屬於使用者資料（data-user-color），不列入。
// 2. 可點擊元件 ≥ 44 × 44 px（SPEC 7、DESIGN 4）。
// 3. 文字沒有被截斷（超出容器又被隱藏）。
// 4. 頁面沒有橫向捲軸。
import { contrastRatio, CONTRAST } from '../color/contrast.js';
import { rgbToHex } from '../color/oklch.js';

function parseRgb(str) {
  const m = /rgba?\(([^)]+)\)/.exec(str);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { hex: rgbToHex([r, g, b]), alpha: a };
}

function effectiveBackground(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const bg = parseRgb(getComputedStyle(n).backgroundColor);
    if (bg && bg.alpha > 0.95) return bg.hex;
  }
  return parseRgb(getComputedStyle(document.body).backgroundColor)?.hex ?? '#FFFFFF';
}

const visible = (el) => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
};

export function auditContrast(min = CONTRAST.text) {
  const fails = [];
  let checked = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!t.textContent.trim() || !el || seen.has(el)) continue;
    seen.add(el);
    if (el.closest('[data-user-color], script, style, .visually-hidden') || !visible(el)) continue;
    const fg = parseRgb(getComputedStyle(el).color);
    if (!fg) continue;
    const bg = effectiveBackground(el);
    const ratio = contrastRatio(fg.hex, bg);
    checked++;
    if (ratio < min) fails.push({ text: t.textContent.trim().slice(0, 20), fg: fg.hex, bg, ratio: Number(ratio.toFixed(2)) });
  }
  return { checked, fails };
}

export function auditTargets(min = 44) {
  const fails = [];
  const els = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="switch"], [tabindex]:not([tabindex="-1"])')].filter(visible);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < min - 0.5 || r.height < min - 0.5) {
      fails.push({ el: el.id || el.className || el.tagName, w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  return { checked: els.length, fails };
}

/** 文字被截斷：內容比容器寬或高，且超出部分被隱藏（可捲動的區塊不算） */
export function auditTruncation() {
  const fails = [];
  let checked = 0;
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el) || el.closest('[data-user-color]') || ['INPUT', 'SVG', 'svg', 'path', 'SCRIPT'].includes(el.tagName)) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    checked++;
    const cs = getComputedStyle(el);
    const clipsX = ['hidden', 'clip'].includes(cs.overflowX) || cs.textOverflow === 'ellipsis';
    const clipsY = ['hidden', 'clip'].includes(cs.overflowY);
    if ((clipsX && el.scrollWidth > el.clientWidth + 1) || (clipsY && el.scrollHeight > el.clientHeight + 1)) {
      fails.push({ text: el.textContent.trim().slice(0, 20), w: `${el.scrollWidth}/${el.clientWidth}`, h: `${el.scrollHeight}/${el.clientHeight}` });
    }
  }
  return { checked, fails };
}

export function auditOverflow() {
  const doc = document.documentElement;
  return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, ok: doc.scrollWidth <= doc.clientWidth };
}

export function runDomAudit() {
  const result = {
    viewport: `${innerWidth}×${innerHeight}`,
    contrast: auditContrast(),
    targets: auditTargets(),
    truncation: auditTruncation(),
    overflow: auditOverflow(),
  };
  result.ok = result.contrast.fails.length === 0 && result.targets.fails.length === 0
    && result.truncation.fails.length === 0 && result.overflow.ok;
  window.__audit = result;
  console.log(`[介面檢查] ${result.ok ? '通過' : '未通過'}（視窗 ${result.viewport}）`);
  console.log(`  文字對比：檢查 ${result.contrast.checked} 處，未達標 ${result.contrast.fails.length} 處`);
  if (result.contrast.fails.length) console.table(result.contrast.fails);
  console.log(`  觸控目標：檢查 ${result.targets.checked} 個，小於 44 px 的 ${result.targets.fails.length} 個`);
  if (result.targets.fails.length) console.table(result.targets.fails);
  console.log(`  文字截斷：檢查 ${result.truncation.checked} 處，被截斷 ${result.truncation.fails.length} 處`);
  if (result.truncation.fails.length) console.table(result.truncation.fails);
  console.log(`  橫向捲軸：${result.overflow.ok ? '沒有' : `有（內容寬 ${result.overflow.scrollWidth}，視窗寬 ${result.overflow.clientWidth}）`}`);
  return result;
}
