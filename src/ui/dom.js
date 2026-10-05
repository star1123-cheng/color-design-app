// DOM 小工具：一律用 textContent 放文字，不使用 innerHTML（避免把資料當 HTML 執行）

/**
 * 建立元素。
 * @param {string} tag
 * @param {Record<string, any>} [attrs] class、style（物件）、dataset（物件）、on（事件物件）、其他屬性
 * @param {...(Node|string|null|false)} children 字串會以文字節點加入
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// 線條式圖示（DESIGN 第 5 節：筆畫 1.7、圓角端點，不使用 Emoji）
const ICONS = {
  copy: ['M9 9h10v10H9z', 'M5 15V5h10'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  alert: ['M12 4l9 16H3z', 'M12 10v4', 'M12 17.2v.1'],
  palette: ['M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-1 .8-1.7 1.9-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z', 'M7.5 11.5h.01', 'M10 7.5h.01', 'M14.5 7.5h.01'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  bookmark: ['M6 4h12v16l-6-4-6 4z'],
  pencil: ['M4 20l4-1 11-11-3-3L5 16z', 'M14 7l3 3'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4z', 'M12 10.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z'],
  share: ['M12 15V4', 'M8 8l4-4 4 4', 'M5 13v6h14v-6'],
};

/** 建立線條 SVG 圖示（裝飾用，aria-hidden） */
export function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name] ?? []) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

/** 清空並放入新內容 */
export function mount(parent, ...children) {
  parent.replaceChildren(...children.flat().filter(Boolean));
}
