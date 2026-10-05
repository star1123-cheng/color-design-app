// 色票卡 PNG（SPEC 4.6 第 3 點、第 6 節）：Canvas 畫圖，支援 Web Share API，不支援時改為下載。
// 版面（cardLayout）與繪製（drawCard）分開：版面是純資料，可以在 Node 測試。
// 卡片上的字一律用配色的字色畫在配色的底色上（推薦結果已確保 ≥ 4.5:1）。
import { toRgbString } from '../color/oklch.js';
import { ROLES } from '../data/schema.js';

export const CARD_SIZE = { width: 1080, height: 1350 }; // 4:5，手機相簿與社群常用比例
const ROLE_LABELS = { primary: '主色', secondary: '輔色', background: '底色', text: '字色', accent: '點綴色' };
const RATIO = [['background', 60], ['primary', 18], ['secondary', 12], ['accent', 10]]; // 與推薦卡片相同

const FONT_SERIF = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';
const FONT_SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const FONT_MONO = '"DM Mono", ui-monospace, Consolas, monospace';

/** 卡片副標：大眾模式顯示風格，老師模式顯示場景 */
function subtitle(palette, sceneLabel) {
  const { style, scene } = palette.context ?? {};
  if (style) return `風格：${style}`;
  if (scene && sceneLabel) return `場景：${sceneLabel}`;
  return '主色・輔色・底色・字色・點綴色';
}

/**
 * 色票卡版面（純資料）。
 * @param {object} palette SPEC 3.1 配色
 * @param {{ sceneLabel?: string }} [opts]
 * @returns {{ width: number, height: number, items: object[] }}
 */
export function cardLayout(palette, { sceneLabel } = {}) {
  const { width, height } = CARD_SIZE;
  const c = palette.colors;
  const ink = c.text.hex;
  const pad = 80;
  const items = [
    { type: 'rect', x: 0, y: 0, w: width, h: height, fill: c.background.hex },
    { type: 'text', x: pad, y: 160, text: '我的配色', font: `700 68px ${FONT_SERIF}`, fill: ink },
    { type: 'text', x: pad, y: 222, text: subtitle(palette, sceneLabel), font: `400 32px ${FONT_SANS}`, fill: ink },
    {
      type: 'bar', x: pad, y: 270, w: width - pad * 2, h: 120, r: 28, stroke: ink,
      segments: RATIO.map(([role, pct]) => ({ role, pct, fill: c[role].hex })),
    },
  ];
  ROLES.forEach((role, i) => {
    const cy = 510 + i * 150;
    const { hex } = c[role];
    items.push(
      { type: 'circle', role, cx: pad + 52, cy, r: 52, fill: hex, stroke: ink },
      { type: 'text', x: pad + 140, y: cy - 14, text: ROLE_LABELS[role], font: `500 30px ${FONT_SANS}`, fill: ink },
      { type: 'text', x: pad + 140, y: cy + 38, text: hex, font: `700 46px ${FONT_MONO}`, fill: ink },
      { type: 'text', x: width - pad, y: cy + 38, text: toRgbString(hex), font: `400 26px ${FONT_SANS}`, fill: ink, align: 'right' },
    );
  });
  items.push({ type: 'text', x: pad, y: height - 70, text: '面積比例 60・30・10', font: `400 26px ${FONT_SANS}`, fill: ink });
  return { width, height, items };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 依版面畫到 Canvas 2D context */
export function drawCard(ctx, layout) {
  for (const it of layout.items) {
    if (it.type === 'rect') {
      ctx.fillStyle = it.fill;
      ctx.fillRect(it.x, it.y, it.w, it.h);
    } else if (it.type === 'bar') {
      ctx.save();
      roundRectPath(ctx, it.x, it.y, it.w, it.h, it.r);
      ctx.clip();
      let x = it.x;
      for (const s of it.segments) {
        const w = (it.w * s.pct) / 100;
        ctx.fillStyle = s.fill;
        ctx.fillRect(x, it.y, w + 1, it.h); // +1 避免色塊之間出現細縫
        x += w;
      }
      ctx.restore();
      roundRectPath(ctx, it.x, it.y, it.w, it.h, it.r);
      ctx.lineWidth = 2;
      ctx.strokeStyle = it.stroke;
      ctx.stroke();
    } else if (it.type === 'circle') {
      ctx.beginPath();
      ctx.arc(it.cx, it.cy, it.r, 0, Math.PI * 2);
      ctx.fillStyle = it.fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = it.stroke;
      ctx.stroke();
    } else if (it.type === 'text') {
      ctx.font = it.font;
      ctx.fillStyle = it.fill;
      ctx.textAlign = it.align ?? 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(it.text, it.x, it.y);
    }
  }
}

/** 產生色票卡 canvas（瀏覽器） */
export function renderCardCanvas(palette, opts = {}, doc = globalThis.document) {
  const layout = cardLayout(palette, opts);
  const canvas = doc.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  drawCard(canvas.getContext('2d'), layout);
  return canvas;
}

/** canvas → PNG Blob */
export const canvasToPng = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('無法產生圖片'))), 'image/png');
});

/** 檔名：palette-主色.png（只用英數，避免不同系統的中文檔名問題） */
export const cardFileName = (palette) => `palette-${palette.colors.primary.hex.slice(1)}.png`;

/** 判斷能否用 Web Share API 分享檔案（手機區網 http、多數電腦瀏覽器不支援） */
export function shareMethod(nav, file) {
  try {
    if (typeof nav?.share === 'function' && typeof nav?.canShare === 'function' && nav.canShare({ files: [file] })) return 'share';
  } catch { /* canShare 在部分瀏覽器會丟錯，視為不支援 */ }
  return 'download';
}

/** 下載 Blob（建立暫時的本機 blob: 網址，下載後釋放） */
export function downloadBlob(blob, filename, { doc = globalThis.document, urlApi = globalThis.URL } = {}) {
  const url = urlApi.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => urlApi.revokeObjectURL(url), 1000);
}

/**
 * 分享色票卡；不支援分享時改為下載。
 * @returns {Promise<'shared'|'cancelled'|'downloaded'>}
 */
export async function shareOrDownload(blob, filename, { nav = globalThis.navigator, doc = globalThis.document, urlApi = globalThis.URL } = {}) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (shareMethod(nav, file) === 'share') {
    try {
      await nav.share({ files: [file], title: '我的配色' });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'; // 使用者自己取消，不另外下載
    }
  }
  downloadBlob(blob, filename, { doc, urlApi });
  return 'downloaded';
}
