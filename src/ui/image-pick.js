// 從圖片取色（SPEC 4.6 第 2 點）：圖片只在本機瀏覽器讀取與分析，不上傳、不連網。
// 流程：選檔 → 本機 blob: 網址 → 縮小畫到 Canvas → 讀像素 → extractColors（k-means）→ 顯示 5 個代表色。
import { extractColors, fitSize } from '../color/extract.js';
import { h, icon, mount } from './dom.js';
import { toast } from './copy.js';

/** 讀取本機圖片檔，回傳縮圖後的像素（RGBA） */
async function readPixels(file) {
  const url = URL.createObjectURL(file); // 本機暫時網址，只在這個分頁有效
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, 160);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height).data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * @param {{ button: HTMLElement, input: HTMLInputElement, panel: HTMLElement, onPick: (hex: string) => void }} opts
 */
export function initImagePick({ button, input, panel, onPick }) {
  button.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = ''; // 讓同一張圖可以再選一次
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('請選擇圖片檔（JPG 或 PNG）'); return; }
    let colors;
    try {
      colors = extractColors(await readPixels(file));
    } catch {
      toast('無法讀取這張圖片，請改用 JPG 或 PNG');
      return;
    }
    if (!colors.length) { toast('這張圖片找不到顏色（可能是全透明）'); return; }
    renderResult(panel, colors, onPick);
  });
}

function renderResult(panel, colors, onPick) {
  panel.hidden = false;
  mount(panel,
    h('div', { class: 'extract-head' },
      h('span', { class: 'extract-title' }, `圖片中的 ${colors.length} 個代表色`),
      h('button', { type: 'button', class: 'btn btn-ghost', 'aria-label': '關閉圖片取色結果', on: { click: () => { panel.hidden = true; mount(panel); } } }, icon('close'))),
    h('p', { class: 'extract-note' }, '點一個顏色當主色。圖片只在你的裝置上分析，不會上傳。'),
    h('ul', { class: 'extract-list' }, colors.map((c) => h('li', {},
      h('button', {
        type: 'button', class: 'extract-item',
        'aria-label': `以 ${c.hex} 為主色（約佔圖片 ${Math.round(c.share * 100)}%）`,
        on: { click: () => onPick(c.hex) },
      },
      h('span', { class: 'extract-swatch', style: { background: c.hex }, 'data-user-color': true, 'aria-hidden': 'true' }),
      h('span', { class: 'extract-hex' }, c.hex),
      h('span', { class: 'extract-share' }, `${Math.round(c.share * 100)}%`))))));
}
