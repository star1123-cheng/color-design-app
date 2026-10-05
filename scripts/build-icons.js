// 產生 PWA 圖示：node scripts/build-icons.js
// 不引入圖片套件：自己算像素（4×4 超取樣抗鋸齒），用 Node 內建 zlib 寫成 PNG。
// 圖案：DESIGN.md 的藍灰、暖米圓與深藍點，底色暖白。所有圖形都在中心半徑 0.4 內（maskable 安全區）。
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = new URL('../icons/', import.meta.url);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex('#F5F1EA');      // --cream
const SHAPES = [                 // [cx, cy, r, color]（單位：圖示邊長）
  [0.42, 0.45, 0.24, hex('#90AFC5')], // --mist
  [0.62, 0.60, 0.17, hex('#D9C9B1')], // --sand
  [0.70, 0.32, 0.06, hex('#3B5C73')], // --mist-deep
];

/** 回傳某個取樣點的 RGBA；rounded 為 true 時四角透明（一般圖示） */
function sample(x, y, rounded) {
  if (rounded) {
    const r = 0.22;
    const dx = Math.max(r - x, 0, x - (1 - r)), dy = Math.max(r - y, 0, y - (1 - r));
    if (dx * dx + dy * dy > r * r) return [0, 0, 0, 0];
  }
  let color = BG;
  for (const [cx, cy, r, c] of SHAPES) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) color = c;
  return [...color, 255];
}

/** 畫出 size × size 的 RGBA 像素 */
export function renderIcon(size, { rounded = true } = {}) {
  const N = 4;
  const px = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const [r, g, b, a] = sample((i + (sx + 0.5) / N) / size, (j + (sy + 0.5) / N) / size, rounded);
          acc[0] += r * a; acc[1] += g * a; acc[2] += b * a; acc[3] += a;
        }
      }
      const o = (j * size + i) * 4;
      const a = acc[3] / (N * N);
      px[o + 3] = Math.round(a);
      for (let k = 0; k < 3; k++) px[o + k] = acc[3] ? Math.round(acc[k] / acc[3]) : 0;
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** RGBA 像素 → PNG（8 位元、色彩類型 6） */
export function encodePng(px, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // 每列的濾波類型：none
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const ICONS = [
  { file: 'icon-192.png', size: 192, rounded: true },
  { file: 'icon-512.png', size: 512, rounded: true },
  { file: 'icon-maskable-192.png', size: 192, rounded: false },
  { file: 'icon-maskable-512.png', size: 512, rounded: false },
];

/** 網頁分頁圖示（SVG，與 PNG 同一個圖案） */
export function iconSvg() {
  const c = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${c(BG)}"/>
${SHAPES.map(([cx, cy, r, col]) => `  <circle cx="${cx * 100}" cy="${cy * 100}" r="${r * 100}" fill="${c(col)}"/>`).join('\n')}
</svg>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(OUT, { recursive: true });
  for (const { file, size, rounded } of ICONS) {
    writeFileSync(new URL(file, OUT), encodePng(renderIcon(size, { rounded }), size));
    console.log(`已產生 icons/${file}（${size} × ${size}${rounded ? '' : '，maskable'}）`);
  }
  writeFileSync(new URL('icon.svg', OUT), iconSvg(), 'utf8');
  console.log('已產生 icons/icon.svg');
}
