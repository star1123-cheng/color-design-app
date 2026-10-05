// 元件配色（2026-10-06 使用者新增）：預覽上每個元件可以另外指定顏色。
// 值可以是五個角色之一（跟著配色變）或大寫 6 碼 HEX（自訂顏色，固定不變）。
// 純資料與純函式，不碰 DOM；預覽、面板、匯出、收藏驗證共用這一份。

// 與 schema.js 的 ROLES 相同（schema.js 會引用本檔驗證收藏，避免互相引用所以另列；tests 確認一致）
export const ROLES = ['primary', 'secondary', 'background', 'text', 'accent'];

const ALL = ['slides', 'webpage', 'worksheet'];
export const PREVIEW_LABELS = { slides: '簡報', webpage: '網頁', worksheet: '學習單' };

/**
 * kind：page 整頁背景；text 文字顏色；fill 色塊（上面的字自動挑清楚的顏色）；border 框線；tint 淡色卡片（底色取淡色、圓點用原色）
 * types：出現在哪些預覽
 */
export const PARTS = {
  background: { label: '背景', kind: 'page', types: ALL },
  title: { label: '標題', kind: 'text', types: ALL },
  kicker: { label: '小標', kind: 'text', types: ['slides', 'worksheet'] },
  body: { label: '內文', kind: 'text', types: ALL },
  pageNo: { label: '頁碼', kind: 'text', types: ['slides'] },
  decoBig: { label: '大圓', kind: 'fill', types: ['slides'] },
  decoMid: { label: '中圓', kind: 'fill', types: ['slides'] },
  decoDot: { label: '小圓點', kind: 'fill', types: ['slides'] },
  logo: { label: '班級標誌', kind: 'fill', types: ['webpage'] },
  cta: { label: '聯絡老師按鈕', kind: 'fill', types: ['webpage'] },
  tag: { label: '公告標籤框', kind: 'border', types: ['webpage'] },
  button: { label: '查看詳情按鈕', kind: 'fill', types: ['webpage'] },
  ghost: { label: '行事曆按鈕框', kind: 'border', types: ['webpage'] },
  blob: { label: '裝飾大圓', kind: 'fill', types: ['webpage'] },
  ring: { label: '裝飾圓框', kind: 'border', types: ['webpage'] },
  dot: { label: '裝飾圓點', kind: 'fill', types: ['webpage'] },
  progress: { label: '進度條', kind: 'fill', types: ['webpage'] },
  card1: { label: '卡片 1（作業）', kind: 'tint', types: ['webpage'] },
  card2: { label: '卡片 2（相簿）', kind: 'tint', types: ['webpage'] },
  card3: { label: '卡片 3（榮譽榜）', kind: 'tint', types: ['webpage'] },
  line: { label: '分隔線', kind: 'border', types: ['worksheet'] },
  qno: { label: '題號', kind: 'fill', types: ['worksheet'] },
  thead: { label: '表頭', kind: 'fill', types: ['worksheet'] },
};

export const PART_KEYS = Object.keys(PARTS);
const HEX = /^#[0-9A-F]{6}$/;

/** 某種預覽有哪些元件（依 PARTS 順序） */
export const partsFor = (type) => PART_KEYS.filter((k) => PARTS[k].types.includes(type));

/** 值是否合法：角色名稱或大寫 6 碼 HEX */
export const isPartValue = (v) => ROLES.includes(v) || (typeof v === 'string' && HEX.test(v));

/** 整份元件配色是否合法（收藏驗證用） */
export const isCustomMap = (m) => m !== null && typeof m === 'object' && !Array.isArray(m)
  && Object.entries(m).every(([k, v]) => Object.hasOwn(PARTS, k) && isPartValue(v));

/** 把值換成色碼：角色取配色裡的色碼，HEX 原樣回傳 */
export const resolvePart = (value, colors) => (ROLES.includes(value) ? colors[value].hex : value);

/** 依 PARTS 順序列出已自訂的元件：[{ key, label, types, value, hex }] */
export function customEntries(custom, colors) {
  if (!custom) return [];
  return PART_KEYS.filter((k) => isPartValue(custom[k])).map((k) => ({
    key: k,
    label: PARTS[k].label,
    types: PARTS[k].types.map((t) => PREVIEW_LABELS[t]),
    value: custom[k],
    hex: resolvePart(custom[k], colors),
  }));
}

/** CSS 變數名稱，例如 decoBig → --part-deco-big */
export const partVar = (k) => `--part-${k.replace(/[A-Z0-9]/g, (ch) => `-${ch.toLowerCase()}`)}`;
