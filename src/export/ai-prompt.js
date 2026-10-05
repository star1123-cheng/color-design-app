// 「複製給 AI 簡報用」（SPEC 6.1）：YAML 設計規格與完整提示詞。
// YAML 只用簡單子集（2 空格縮排、無 Tab、字串一律雙引號、HEX 大寫），由字串模板產生，不使用任何 YAML 套件。
// 內容一律從 SPEC 3.1 的配色 JSON 產生，不另存第二份資料；不放任何個資、網址或金鑰。
import { ROLES } from '../data/schema.js';
import { minTextContrast } from '../data/presets.js';

const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** 正文最低對比度：由 context 的場景與投影模式決定（大眾模式以上課簡報計） */
export const textMinContrast = (p) => minTextContrast(p.context?.scene ?? 'slides', Boolean(p.context?.projection));

/** YAML 設計規格 */
export function toYaml(p) {
  const t = p.typography;
  const lines = [
    'palette:',
    ...ROLES.map((r) => `  ${r}: ${q(p.colors[r].hex.toUpperCase())}`),
    'typography:',
    `  unit: ${q(t.unit)}`,
    `  title: ${t.title}`,
    `  body: ${t.body}`,
    'rules:',
    ...(t.maxPointsPerSlide ? [`  max_points_per_slide: ${t.maxPointsPerSlide}`] : []),
    `  text_on_background_min_contrast: ${textMinContrast(p)}`,
  ];
  return `${lines.join('\n')}\n`;
}

/** 完整提示詞：口語說明（Markdown）＋ YAML 設計規格 */
export function toFullPrompt(p) {
  const max = p.typography.maxPointsPerSlide;
  return [
    '請為「（請填入主題）」製作一份簡報。',
    '',
    '## 內容要求',
    `- 使用台灣繁體中文與台灣用語${max ? `；每頁不超過 ${max} 個重點` : ''}。`,
    '',
    '## 設計規格',
    '請嚴格遵守下列 YAML：',
    '',
    '```yaml',
    toYaml(p).trimEnd(),
    '```',
    '',
    '## 補充規則',
    '- 色彩面積比例約 60-30-10（底色 60%、主色與輔色 30%、點綴色 10%）。',
    '- 不得使用規格以外的顏色。',
    '- 文字只用 text 色，不用純黑。',
    '',
  ].join('\n');
}
