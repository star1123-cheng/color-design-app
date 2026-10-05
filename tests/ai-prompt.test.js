// 階段 4B：複製給 AI 簡報用（SPEC 6.1）：快照測試、格式規則測試、極簡解析器逐欄比對
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toYaml, toFullPrompt } from '../src/export/ai-prompt.js';
import { recommend } from '../src/color/palette.js';
import { createRng } from '../src/color/harmony.js';
import { SCENE_KEYS } from '../src/data/presets.js';

// 固定資料（快照用）：SPEC 3.1 格式，數值只是示意
const FIXED = {
  schemaVersion: 1, id: 'fixed', name: '測試', mode: 'teacher',
  context: { scene: 'slides', style: null, projection: false },
  colors: {
    primary: { hex: '#78A5CE', oklch: [0.705, 0.078, 246.6] },
    secondary: { hex: '#EFBDBE', oklch: [0.839, 0.052, 13.5] },
    background: { hex: '#F6F0E5', oklch: [0.958, 0.014, 84.1] },
    text: { hex: '#1D303E', oklch: [0.302, 0.035, 240.0] },
    accent: { hex: '#689039', oklch: [0.605, 0.125, 130.0] },
  },
  checks: { contrast: { textOnBackground: 12.3, accentOnBackground: 3.3 }, grayscaleLDiff: 0.14, cvd: { protan: true, deutan: true, tritan: true }, warnings: [] },
  typography: { unit: 'pt', title: 36, body: 20, maxPointsPerSlide: 3 },
};

const YAML_SNAPSHOT = `palette:
  primary: "#78A5CE"
  secondary: "#EFBDBE"
  background: "#F6F0E5"
  text: "#1D303E"
  accent: "#689039"
typography:
  unit: "pt"
  title: 36
  body: 20
rules:
  max_points_per_slide: 3
  text_on_background_min_contrast: 4.5
`;

test('快照：YAML 設計規格', () => {
  assert.equal(toYaml(FIXED), YAML_SNAPSHOT);
});

test('快照：完整提示詞（口語說明＋YAML）', () => {
  assert.equal(toFullPrompt(FIXED), `請為「（請填入主題）」製作一份簡報。

## 內容要求
- 使用台灣繁體中文與台灣用語；每頁不超過 3 個重點。

## 設計規格
請嚴格遵守下列 YAML：

\`\`\`yaml
${YAML_SNAPSHOT.trimEnd()}
\`\`\`

## 補充規則
- 色彩面積比例約 60-30-10（底色 60%、主色與輔色 30%、點綴色 10%）。
- 不得使用規格以外的顏色。
- 文字只用 text 色，不用純黑。
`);
});

/** 極簡 YAML 解析器：只支援 SPEC 6.1 子集（兩層、2 空格縮排、雙引號字串或數字） */
function parseMiniYaml(text) {
  const out = {};
  let section = null;
  for (const line of text.split('\n')) {
    if (!line) continue;
    let m;
    if ((m = /^([a-z_]+):$/.exec(line))) { section = m[1]; out[section] = {}; continue; }
    if ((m = /^ {2}([a-z_]+): (?:"((?:[^"\\]|\\.)*)"|(-?\d+(?:\.\d+)?))$/.exec(line)) && section) {
      out[section][m[1]] = m[2] !== undefined ? m[2].replace(/\\(.)/g, '$1') : Number(m[3]);
      continue;
    }
    throw new Error(`不符合子集的一行：${JSON.stringify(line)}`);
  }
  return out;
}

/** 格式規則（SPEC 6.1） */
function assertFormat(yaml) {
  assert.doesNotMatch(yaml, /\t/, '不得有 Tab');
  for (const line of yaml.trimEnd().split('\n')) {
    const indent = /^ */.exec(line)[0].length;
    assert.ok(indent === 0 || indent === 2, `縮排只能 0 或 2 個空格：${line}`);
    const value = line.split(': ')[1];
    if (value !== undefined && !/^-?\d+(\.\d+)?$/.test(value)) assert.match(value, /^".*"$/, `字串要雙引號：${line}`);
    if (/#[0-9a-f]{6}/i.test(line)) assert.match(line, /"#[0-9A-F]{6}"/, `HEX 要大寫：${line}`);
  }
}

test('格式規則：固定資料與隨機 200 組推薦都符合子集', () => {
  assertFormat(toYaml(FIXED));
  const rng = createRng(61);
  for (let i = 0; i < 200; i++) {
    const hex = '#' + Math.floor(rng() * 0x1000000).toString(16).padStart(6, '0');
    const [p] = recommend(hex, { mode: 'teacher', scene: SCENE_KEYS[i % 4], projection: i % 3 === 0 });
    assertFormat(toYaml(p));
  }
});

test('解析比對：YAML 解析後與來源 JSON 逐欄一致（四個場景、投影模式）', () => {
  for (const scene of SCENE_KEYS) {
    for (const projection of [false, true]) {
      const [p] = recommend('#6B9274', { mode: 'teacher', scene, projection });
      const y = parseMiniYaml(toYaml(p));
      for (const r of ['primary', 'secondary', 'background', 'text', 'accent']) assert.equal(y.palette[r], p.colors[r].hex, `${scene} ${r}`);
      assert.deepEqual(y.typography, { unit: p.typography.unit, title: p.typography.title, body: p.typography.body });
      if (p.typography.maxPointsPerSlide) assert.equal(y.rules.max_points_per_slide, p.typography.maxPointsPerSlide);
      else assert.ok(!('max_points_per_slide' in y.rules), '沒有重點上限時不輸出該欄');
      const expected = projection || scene === 'poster' ? 7 : 4.5;
      assert.equal(y.rules.text_on_background_min_contrast, expected, `${scene} ${projection}`);
    }
  }
});

test('解析器本身會拒絕子集以外的寫法（防止測試失效）', () => {
  assert.throws(() => parseMiniYaml('palette:\n\tprimary: "#000000"\n'));
  assert.throws(() => parseMiniYaml('palette:\n    primary: "#000000"\n'));
  assert.throws(() => parseMiniYaml('palette:\n  primary: #000000\n'));
});

test('字級微調後的 typography 會反映在 YAML（從同一份 JSON 產生）', () => {
  const p = { ...FIXED, typography: { ...FIXED.typography, title: 42, body: 22 } };
  const y = parseMiniYaml(toYaml(p));
  assert.equal(y.typography.title, 42);
  assert.equal(y.typography.body, 22);
});

test('輸出不含個資、網址或金鑰樣式字串', () => {
  const p = { ...FIXED, name: '50101 的配色' }; // name 不應輸出
  for (const out of [toYaml(p), toFullPrompt(p)]) {
    assert.doesNotMatch(out, /https?:\/\/|www\.|@|50101|fixed|sk-|AKIA|ghp_|AIza|token|password/i);
  }
});

test('沒有使用 YAML 套件：package.json 沒有 dependencies，原始碼沒有匯入 yaml', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0);
  const src = readFileSync(new URL('../src/export/ai-prompt.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from ['"][^'"]*yaml/i);
});
