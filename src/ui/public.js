// 大眾模式（SPEC 4.6）：六個風格標籤、色票卡預覽與分享。
import { h, icon, mount } from './dom.js';
import { toast } from './copy.js';
import { STYLES } from '../data/presets.js';
import { STYLE_HINTS } from '../color/palette.js';
import { renderCardCanvas, canvasToPng, cardFileName, shareMethod, shareOrDownload } from '../export/card.js';

/** 風格標籤：不限＋六個風格；復古、夜間標示「建置中」，不可選 */
export function renderStyleChips(chips, hint, style, onStyle) {
  const options = [{ key: null, available: true }, ...STYLES];
  mount(chips, options.map((s) => {
    if (!s.available) {
      return h('button', {
        type: 'button', class: 'chip', 'aria-disabled': 'true',
        on: { click: () => toast(`「${s.key}」的範例還不夠，規則建置中`) },
      }, `${s.key}・建置中`);
    }
    return h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(style === s.key),
      on: { click: () => onStyle(s.key) },
    }, s.key ?? '不限');
  }));
  hint.textContent = style
    ? `${style}：${STYLE_HINTS[style]}。會保留你選的色相，只調整鮮豔程度與搭配。`
    : '選一個風格，推薦會往那個方向調整。';
}

// 判斷分享按鈕的文字用（只是測試瀏覽器能力，不會分享）
const canShareFiles = () => {
  try {
    return shareMethod(navigator, new File([new Uint8Array(1)], 'test.png', { type: 'image/png' })) === 'share';
  } catch { return false; }
};

/** 色票卡預覽與分享（不支援分享時改為下載） */
export function renderShareCard(panel, palette) {
  const canvas = renderCardCanvas(palette);
  canvas.className = 'card-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `色票卡預覽：主色 ${palette.colors.primary.hex}`);
  canvas.dataset.userColor = '';
  const share = canShareFiles();
  const filename = cardFileName(palette);
  const btn = h('button', {
    type: 'button', class: 'btn btn-primary',
    on: {
      click: async () => {
        btn.setAttribute('aria-busy', 'true');
        try {
          const result = await shareOrDownload(await canvasToPng(canvas), filename);
          if (result === 'shared') toast('已分享色票卡');
          if (result === 'downloaded') toast(`已下載色票卡 ${filename}`);
        } catch {
          toast('無法產生色票卡圖片');
        } finally {
          btn.removeAttribute('aria-busy');
        }
      },
    },
  }, icon(share ? 'share' : 'download'), share ? '分享色票卡' : '下載色票卡');

  mount(panel,
    h('div', { class: 'ratio-head' }, h('h3', {}, '色票卡'), h('span', { class: 'mono-note' }, 'PNG')),
    h('div', { class: 'card-canvas-wrap' }, canvas),
    btn);
}
