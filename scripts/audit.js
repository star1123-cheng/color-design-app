// 介面靜態檢查：node scripts/audit.js（或 npm run audit）
// 通過時結束代碼為 0，有任何一項未通過為 1。
//
// 檢查項目：
// 1. 介面文字對比度（DESIGN 第 2 節、SPEC 4.3）：從 src/ui/styles.css 讀出色彩 tokens 與每個規則的文字色／底色。
// 2. DESIGN 禁止事項：原色不得當文字色、不寫死色碼、不用純白純黑、漸層只用在明度滑桿。
// 3. 觸控目標 ≥ 44 px（DESIGN 第 4 節）：可點擊元件的 CSS 尺寸。
// 4. 網頁不得讀取 reference/；reference/ 未被 Git 追蹤。
// 5. 介面、src/、docs/ 等不得出現原始色名或拼音（名稱清單即時讀自 reference/，不寫進本檔）。
// 6. 網頁防護：src/ 不使用 innerHTML；不連外部網址。
// 7. 範本庫 src/data/templates.js：不含原始色名或拼音、HEX 格式、數量一致、編號不重複、風格與來源標示。
//
// 執行時的實際量測（排版後的對比、元件尺寸、截斷、橫向捲軸）請用瀏覽器開啟 ?audit=1，見 src/ui/audit-dom.js。
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { contrastRatio, CONTRAST } from '../src/color/contrast.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => existsSync(path.join(ROOT, rel));

function walk(rel, exts) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const r = path.posix.join(rel, name);
    const st = statSync(path.join(ROOT, r));
    if (st.isDirectory()) return walk(r, exts);
    return exts.includes(path.extname(name)) ? [r] : [];
  });
}

const results = [];
const check = (group, name, ok, detail = '') => results.push({ group, name, ok, detail });

// ---------- 解析 CSS ----------
const CSS_FILE = 'src/ui/styles.css';
const css = read(CSS_FILE).replace(/\/\*[\s\S]*?\*\//g, '');

const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
const tokens = Object.fromEntries([...rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const colorTokens = Object.fromEntries(Object.entries(tokens).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v)).map(([k, v]) => [k, v.toUpperCase()]));

// 取最內層的「選擇器 { 宣告 }」；@media 的外層括號會被略過
const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] }))
  .filter((b) => !b.selector.startsWith('@') && b.selector !== ':root');

const decl = (body, prop) => new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`).exec(body)?.[1].trim();
const varOf = (v) => /^var\((--[\w-]+)\)$/.exec(v ?? '')?.[1];

// ---------- 1、2：對比度與 DESIGN 禁止事項 ----------
const GENERAL_SURFACES = ['--cream', '--surface'];   // 一般文字所在的底色
const NEVER_TEXT = ['--mist', '--stone', '--sand-deep']; // DESIGN：原色與點綴色不得當文字色
const MIN = CONTRAST.text;                              // 介面文字一律以 4.5:1 檢查

let pairCount = 0;
for (const { selector, body } of blocks) {
  if (selector.includes('::')) continue; // 偽元素（滑桿軌道、拇指）不含文字
  const fgVar = varOf(decl(body, 'color'));
  const bgRaw = decl(body, 'background') ?? decl(body, 'background-color');
  const bgVar = varOf(bgRaw);

  if (fgVar) {
    if (!colorTokens[fgVar]) { check('對比度', selector, false, `文字色 ${fgVar} 不是色彩 token`); continue; }
    if (NEVER_TEXT.includes(fgVar)) check('DESIGN 禁止事項', selector, false, `${fgVar} 不得當文字色`);
    if (fgVar === '--sand' && bgVar !== '--ink') check('DESIGN 禁止事項', selector, false, '--sand 只能用在 --ink 底的程式碼區塊');
    const bgs = bgVar ? [bgVar] : GENERAL_SURFACES;
    for (const bg of bgs) {
      if (!colorTokens[bg]) continue;
      const r = contrastRatio(colorTokens[fgVar], colorTokens[bg]);
      pairCount++;
      if (r < MIN) check('對比度', selector, false, `${fgVar} on ${bg} = ${r.toFixed(2)}:1，未達 ${MIN}:1`);
    }
  } else if (bgVar && !GENERAL_SURFACES.includes(bgVar) && colorTokens[bgVar]) {
    check('對比度', selector, false, `設定了 ${bgVar} 底色，但沒有同時設定文字色`);
  }

  if (/#[0-9a-f]{3,8}\b/i.test(body)) check('DESIGN 禁止事項', selector, false, '色碼必須寫在 :root 的 tokens，不得在規則中寫死');
  if (/linear-gradient|radial-gradient/.test(body) && !selector.includes('range')) check('DESIGN 禁止事項', selector, false, '漸層只能用在明度滑桿');
  if (/rgba?\(/.test(body) && !/box-shadow|--shadow/.test(body)) check('DESIGN 禁止事項', selector, false, 'rgba() 只能用於陰影');
}
check('對比度', `共檢查 ${pairCount} 組文字色／底色`, pairCount > 0);

for (const file of ['index.html', CSS_FILE]) {
  const t = read(file);
  check('DESIGN 禁止事項', `${file} 不使用純白、純黑`, !/#(?:fff(?:fff)?|000(?:000)?)\b/i.test(t));
}

// ---------- 3：觸控目標 ----------
const TAP = Number.parseFloat(tokens['--tap'] ?? '0');
check('觸控目標', `--tap = ${tokens['--tap'] ?? '（未定義）'} ≥ 44px`, TAP >= 44);
const baseRule = blocks.find((b) => ['button', 'input[type="range"]', 'input[type="color"]', 'input[type="text"]', 'a.navlink']
  .every((s) => b.selector.split(',').map((x) => x.trim()).includes(s)));
check('觸控目標', '按鈕、輸入框、滑桿、導覽連結有共同的最小尺寸規則',
  Boolean(baseRule && varOf(decl(baseRule.body, 'min-height')) === '--tap' && varOf(decl(baseRule.body, 'min-width')) === '--tap'));
// 只看每個選擇器「最後指向的元素」：例如 .btn svg 指向圖示（不檢查），.seg button 指向按鈕（檢查）
const INTERACTIVE_SUBJECT = /^(?:button|input|a)\b|^\.(?:btn|card|navlink|seg|chip)\b/;
const subjects = (selector) => selector.split(',').map((s) => s.trim().split(/\s*[\s>+~]\s*/).pop());
for (const { selector, body } of blocks) {
  if (selector.includes('::') || !subjects(selector).some((s) => INTERACTIVE_SUBJECT.test(s))) continue;
  for (const prop of ['height', 'min-height', 'width', 'min-width']) {
    const v = decl(body, prop);
    const px = v && /^(\d+(?:\.\d+)?)px$/.exec(v);
    if (px && Number(px[1]) < 44) check('觸控目標', selector, false, `${prop}: ${v} 小於 44px`);
  }
}

// ---------- 4：reference/ ----------
const webFiles = ['index.html', ...walk('src', ['.js', '.css', '.html'])];
const refHits = webFiles.filter((f) => /reference\//i.test(read(f)));
check('reference/', '網頁檔案沒有引用 reference/', refHits.length === 0, refHits.join('、'));
let tracked = [];
try {
  tracked = execFileSync('git', ['ls-files', 'reference'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  check('reference/', 'reference/ 沒有被 Git 追蹤', tracked.length === 0, tracked.slice(0, 5).join('、'));
} catch {
  check('reference/', 'reference/ 沒有被 Git 追蹤（無法執行 git，略過）', true);
}

// ---------- 5：原始色名與拼音 ----------
const scanFiles = [
  ...webFiles,
  ...walk('docs', ['.md', '.csv']),
  ...walk('scripts', ['.js']).filter((f) => f !== 'scripts/audit.js'),
  ...walk('tests', ['.js']),
  ...['README.md', 'SPEC.md', 'DESIGN.md', 'CLAUDE.md', 'PROMPTS.md', 'package.json'].filter(exists),
];
if (!exists('reference')) {
  check('原始名稱', 'reference/ 不存在，無法取得名稱清單（略過）', true);
} else {
  const words = new Set();
  // (a) 檔名：完整檔名主幹，以及 11 號以後的拼音片段
  for (const name of readdirSync(path.join(ROOT, 'reference'))) {
    const stem = name.replace(/\.[^.]+$/, '');
    if (!/^\d{2}_/.test(stem)) continue;
    words.add(stem);
    const parts = stem.replace(/^\d{2}_/, '').split(/[_-]/);
    const series = new Set(['guofeng', 'trad2', 'best3', 'slow3', 'bw3', 'safe4', 'origin', 'step5']);
    if (Number(stem.slice(0, 2)) >= 11) parts.filter((p) => p.length >= 4 && !series.has(p)).forEach((p) => words.add(p));
    else words.add(stem.replace(/^\d{2}_/, '').split('_')[0]); // 01–10：第一段完整片語（例如 wu-mei-fen）
  }
  // (b) manifest.csv 的色名欄（中文名稱）
  const manifest = 'reference/manifest.csv';
  if (exists(manifest)) {
    const lines = read(manifest).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
    const header = lines[0].split(',');
    const col = header.findIndex((h) => h.includes('色名'));
    if (col >= 0) lines.slice(1).forEach((l) => (l.split(',')[col] ?? '').split('、').map((s) => s.trim()).filter(Boolean).forEach((w) => words.add(w)));
  }
  // (c) 選用：reference/names-extra.txt（一行一個名稱，用來補 manifest 沒列的 01–10 色名；該資料夾不提交）
  if (exists('reference/names-extra.txt')) read('reference/names-extra.txt').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((w) => words.add(w));

  // 範本庫單獨列一項，明確標示 templates.js 已檢查
  const TPL_FILE = 'src/data/templates.js';
  if (exists(TPL_FILE)) {
    const t = read(TPL_FILE);
    const tplHits = [...words].filter((w) => t.includes(w));
    check('範本庫', `${TPL_FILE} 不含原始色名或拼音（檢查 ${words.size} 個名稱）`, tplHits.length === 0, tplHits.slice(0, 10).join('、'));
  }

  const hits = [];
  for (const f of scanFiles) {
    let t = read(f);
    // CSS 屬性名稱是語法關鍵字（例如 white-space），不是內容；先移除再比對，選擇器與屬性值仍會檢查
    if (f.endsWith('.css')) t = t.replace(/(^|[;{\s])[\w-]+\s*:/g, '$1');
    for (const w of words) if (t.includes(w)) hits.push(`${f} → ${w}`);
  }
  check('原始名稱', `檢查 ${words.size} 個名稱、${scanFiles.length} 個檔案，沒有原始色名或拼音`, hits.length === 0, hits.slice(0, 10).join('；'));
  if (!exists('reference/names-extra.txt')) {
    check('原始名稱', '提醒：manifest.csv 沒有 01–10 的中文色名；可建立 reference/names-extra.txt 補上（選用）', true);
  }
}

// ---------- 7：範本庫資料（src/data/templates.js） ----------
if (!exists('src/data/templates.js')) {
  check('範本庫', 'src/data/templates.js 存在', false);
} else {
  const { TEMPLATES, TEMPLATE_COUNT } = await import('../src/data/templates.js');
  const { TEMPLATE_STYLES, SOURCE_SAMPLE, SOURCE_ENGINE } = await import('../src/data/template-palette.js');
  const ROLE_KEYS = ['primary', 'secondary', 'background', 'text', 'accent'];
  const HEX = /^#[0-9A-F]{6}$/;
  const ids = TEMPLATES.map((t) => t.id);
  check('範本庫', `數量一致：TEMPLATE_COUNT ${TEMPLATE_COUNT} = 實際 ${TEMPLATES.length}`, TEMPLATES.length > 0 && TEMPLATE_COUNT === TEMPLATES.length);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  check('範本庫', '編號不重複', dupIds.length === 0, dupIds.join('、'));
  const badIds = ids.filter((id) => !/^T-\d{3}$/.test(id));
  check('範本庫', '編號格式為 T-001', badIds.length === 0, badIds.join('、'));
  const badHex = TEMPLATES.flatMap((t) => [
    ...ROLE_KEYS.filter((r) => !HEX.test(t.colors?.[r] ?? '')).map((r) => `${t.id} ${r}`),
    ...(t.unused ?? []).filter((x) => !HEX.test(x)).map((x) => `${t.id} unused ${x}`),
  ]);
  check('範本庫', '五個角色齊全，HEX 為大寫 6 碼', badHex.length === 0, badHex.slice(0, 10).join('、'));
  const badStyle = TEMPLATES.filter((t) => !TEMPLATE_STYLES.includes(t.style)).map((t) => `${t.id} ${t.style}`);
  check('範本庫', `風格只用 SPEC 4.6 的名稱（${TEMPLATE_STYLES.join('、')}）`, badStyle.length === 0, badStyle.join('、'));
  const badSource = TEMPLATES.filter((t) => ROLE_KEYS.some((r) => ![SOURCE_SAMPLE, SOURCE_ENGINE].includes(t.source?.[r]))).map((t) => t.id);
  check('範本庫', '每個角色都標示色碼來源（範例／引擎補色）', badSource.length === 0, badSource.join('、'));
  const badStatus = TEMPLATES.filter((t) => !['收錄', '待決定'].includes(t.status) || !Array.isArray(t.adjusted)
    || t.adjusted.some((r) => !ROLE_KEYS.includes(r)) || (t.status === '待決定' && !t.issues?.length)).map((t) => t.id);
  check('範本庫', '狀態為收錄／待決定，待決定者附未通過原因', badStatus.length === 0, badStatus.join('、'));
}

// ---------- 6：網頁防護 ----------
const innerHits = webFiles.filter((f) => f.endsWith('.js') && /\.innerHTML\s*=|insertAdjacentHTML|outerHTML\s*=/.test(read(f)));
check('網頁防護', 'src/ 不使用 innerHTML（一律用 textContent）', innerHits.length === 0, innerHits.join('、'));
const urlHits = webFiles.flatMap((f) => [...read(f).matchAll(/https?:\/\/[^\s'")]+/g)].map((m) => m[0])
  // SVG 命名空間只是識別字；localhost／127.0.0.1 是本機預覽說明，都不是對外連線
  .filter((u) => !/^https?:\/\/(www\.w3\.org\/|localhost[:/]|127\.0\.0\.1[:/])/.test(u)).map((u) => `${f}：${u}`));
check('網頁防護', '網頁檔案沒有外部網址（不連網路）', urlHits.length === 0, urlHits.slice(0, 5).join('；'));

// ---------- 輸出 ----------
let failed = 0;
let group = '';
for (const r of results) {
  if (r.group !== group) { group = r.group; console.log(`\n【${group}】`); }
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? '✔' : '✖'} ${r.name}${r.detail ? `：${r.detail}` : ''}`);
}
console.log(`\n${failed ? `未通過 ${failed} 項` : '全部通過'}（共 ${results.length} 項）`);
process.exitCode = failed ? 1 : 0;
