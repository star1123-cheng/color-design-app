// 產生 src/data/templates.js（範本庫）：node scripts/build-templates.js
//
// 資料來源：只用 scripts/build-palettes.js 已整理的色碼（階段 0 讀自範例圖上印的 HEX／RGB），
//           不讀取 reference/，不讀取圖片。（SPEC 第 2 節第 7 點例外條款）
// 規則：
// - 範例本身有的顏色一律保留原色，標示來源「範例」。
// - 缺少的角色由引擎補色，標示「引擎補色」：
//     底色、輔色、點綴色：取 recommend(範例主色) 第一組的對應角色。
//     字色：用 makeText 依「這組範本實際的底色」計算（引擎產生字色的同一個函式）。
// - 不事後改色。檢查未通過者標為「待決定」，網頁不顯示，列給使用者決定。
// - 漸層色票不收錄（沒有五個角色）。
// - 編號 T-001 起，依 SPEC 4.6 風格順序 → 範例編號排序後重新編號；範例編號只出現在本腳本的終端機輸出。
// - 使用者決定捨棄的範本列在 DISCARDED_IDS，不寫入 templates.js（編號保留空號）。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildRows } from './build-palettes.js';
import { recommend, makeText } from '../src/color/palette.js';
import { hexToOklch } from '../src/color/oklch.js';
import { CONTRAST } from '../src/color/contrast.js';
import {
  TEMPLATE_STYLES, SOURCE_SAMPLE, SOURCE_ENGINE, ROLE_LABELS, checkTemplate,
} from '../src/data/template-palette.js';

const ROLE_KEY = { 主色: 'primary', 輔色: 'secondary', 底色: 'background', 字色: 'text', 點綴色: 'accent' };

// 使用者決定捨棄的範本（2026-10-05）：點綴色對底色未達 3:1（SPEC 4.3 圖形元件）。
// 編號先依全部 52 組排定再移除，其他範本的編號不變。
export const DISCARDED_IDS = ['T-007', 'T-033', 'T-042'];
const ROLES = Object.keys(ROLE_LABELS);

/** 由一組範例色票建立範本（不含編號） */
export function makeTemplate(row) {
  const colors = {};
  const source = {};
  const unused = [];
  row.roles.forEach((role, i) => {
    const key = ROLE_KEY[role];
    if (key && !colors[key]) { colors[key] = row.hex[i]; source[key] = SOURCE_SAMPLE; } else unused.push(row.hex[i]);
  });

  const engine = recommend(colors.primary, { mode: 'public', scene: 'slides', bgFamilies: ['warm'], extendedTypes: false })[0].colors;
  for (const key of ['background', 'secondary', 'accent']) {
    if (!colors[key]) { colors[key] = engine[key].hex; source[key] = SOURCE_ENGINE; }
  }
  if (!colors.text) {
    colors.text = makeText(hexToOklch(colors.primary), colors.background, CONTRAST.text).hex;
    source.text = SOURCE_ENGINE;
  }

  const t = {
    style: row.style,
    colors: Object.fromEntries(ROLES.map((r) => [r, colors[r]])),
    source: Object.fromEntries(ROLES.map((r) => [r, source[r]])),
    adjusted: [],
    unused,
  };
  const { blocking, info } = checkTemplate({ id: 'T-000', ...t, issues: [] });
  return { ...t, status: blocking.length ? '待決定' : '收錄', issues: [...blocking, ...info] };
}

/** 產生全部範本（含編號）；sampleNo 只供終端機對照，不寫入 templates.js */
export function buildTemplates() {
  const rows = buildRows().filter((r) => !r.gradient);
  rows.sort((a, b) => TEMPLATE_STYLES.indexOf(a.style) - TEMPLATE_STYLES.indexOf(b.style) || Number(a.no) - Number(b.no));
  return rows
    .map((row, i) => ({ id: `T-${String(i + 1).padStart(3, '0')}`, ...makeTemplate(row), sampleNo: row.no }))
    .filter((t) => !DISCARDED_IDS.includes(t.id));
}

function toSource(list) {
  const items = list.map(({ sampleNo, ...t }) => `  ${JSON.stringify(t)},`).join('\n');
  return `// 範本庫（自動產生，請勿手動修改）：由 scripts/build-templates.js 產生
// 只收錄色碼，不含原始名稱、拼音與圖片（SPEC 第 2 節第 7 點例外條款）。
// 欄位：id 自編編號；style 風格（SPEC 4.6）；colors 五個角色 HEX；source 色碼來源（範例／引擎補色）；
//       adjusted 以 adjustForContrast 調整過的角色；unused 範例中未對應到角色的顏色；
//       status 收錄／待決定（待決定者網頁不顯示）；issues 未通過原因與參考資訊。
export const TEMPLATES_VERSION = 1;
export const TEMPLATE_COUNT = ${list.length};
export const TEMPLATES = [
${items}
];
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const list = buildTemplates();
  writeFileSync(new URL('../src/data/templates.js', import.meta.url), toSource(list), 'utf8');
  const count = (s) => list.filter((t) => t.status === s).length;
  console.log(`已寫入 src/data/templates.js：共 ${list.length} 組，收錄 ${count('收錄')}、待決定 ${count('待決定')}`);
  const byStyle = Object.fromEntries(TEMPLATE_STYLES.map((s) => [s, list.filter((t) => t.style === s).length]));
  console.log('風格分布：', JSON.stringify(byStyle));
  const filled = {};
  for (const t of list) for (const r of ROLES) if (t.source[r] === SOURCE_ENGINE) filled[ROLE_LABELS[r]] = (filled[ROLE_LABELS[r]] ?? 0) + 1;
  console.log('引擎補色次數：', JSON.stringify(filled));
  if (process.argv.includes('--verbose')) {
    for (const t of list) console.log(`${t.id}（範例 ${t.sampleNo}）${t.style} ${t.status}｜${Object.values(t.colors).join(' ')}｜${t.issues.join('；')}`);
  }
}
