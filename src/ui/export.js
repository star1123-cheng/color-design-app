// 匯出區（SPEC 第 6 節、6.1）：切換格式、預覽文字、一鍵複製。
// 另有「複製給 AI 簡報用」（YAML 設計規格｜完整提示詞）。2026-10-05 起不分模式，全部顯示。
import { h, icon, mount } from './dom.js';
import { copyText } from './copy.js';
import { hexList, rgbList, cssVariables, cssOklch, slidesThemeText, selectedGradient } from '../export/formats.js';
import { toYaml, toFullPrompt } from '../export/ai-prompt.js';

export const FORMATS = {
  hex: { label: 'HEX', make: hexList, copied: '全部 5 個色碼' },
  rgb: { label: 'RGB', make: rgbList, copied: 'RGB 清單' },
  css: { label: 'CSS 變數', make: cssVariables, copied: 'CSS 變數' },
  oklch: { label: 'oklch()', make: cssOklch, copied: 'oklch() 版本' },
  slides: { label: 'Google 簡報', make: slidesThemeText, copied: 'Google 簡報主題色' },
};
const AI = { yaml: { label: 'YAML 設計規格', make: toYaml }, prompt: { label: '完整提示詞', make: toFullPrompt } };

const seg = (label, options, current, onPick) => h('div', { class: 'chips chips-wrap', role: 'group', 'aria-label': label },
  options.map(([key, text]) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(current === key), on: { click: () => onPick(key) },
  }, text)));

/**
 * @param {HTMLElement} panel
 * @param {object} palette SPEC 3.1 配色（含字級微調）
 * @param {{ format: string, aiFormat: string, gradient?: { key: string|null, target: string, dir: string }, custom?: Record<string, string> }} st
 *   gradient：選定的漸層；custom：元件配色。兩者都會一起放進匯出內容
 * @param {{ onFormat: (f: string) => void, onAiFormat: (f: string) => void }} handlers
 */
export function renderExport(panel, palette, st, { onFormat, onAiFormat }) {
  const keys = Object.keys(FORMATS);
  const format = keys.includes(st.format) ? st.format : 'hex';
  const g = selectedGradient(palette, st.gradient);
  const custom = st.custom ?? null;
  const text = FORMATS[format].make(palette, g, custom);
  const ai = AI[st.aiFormat] ? st.aiFormat : 'yaml';
  const aiText = AI[ai].make(palette, g, custom);
  const nParts = Object.keys(custom ?? {}).length;
  mount(panel,
    h('div', { class: 'ratio-head' }, h('h3', {}, '匯出'), h('span', { class: 'mono-note' }, FORMATS[format].label)),
    h('p', { class: 'hint' }, [
      g ? `已附上選用的漸層「${g.name}」。` : '在「漸層搭配建議」選用漸層後，匯出內容會一起附上。',
      nParts ? `已附上 ${nParts} 個元件配色。` : '',
    ].join('')),
    seg('匯出格式', keys.map((k) => [k, FORMATS[k].label]), format, onFormat),
    h('pre', { class: 'code', 'aria-label': `${FORMATS[format].label}內容` }, text),
    h('button', { type: 'button', class: 'btn btn-primary', on: { click: () => copyText(text, FORMATS[format].copied) } },
      icon('copy'), `複製 ${FORMATS[format].label}`),
    h('div', { class: 'ratio-head ai-head' }, h('h3', {}, '複製給 AI 簡報用'), h('span', { class: 'mono-note' }, 'ChatGPT・Claude・Gemini')),
    h('p', { class: 'hint' }, '把配色和字級規格貼給 AI，請它照著做簡報。「完整提示詞」可以直接貼上，再把主題改成你的。'),
    seg('AI 簡報格式', Object.entries(AI).map(([k, v]) => [k, v.label]), ai, onAiFormat),
    h('pre', { class: 'code', 'aria-label': `${AI[ai].label}內容` }, aiText),
    h('button', { type: 'button', class: 'btn btn-primary', on: { click: () => copyText(aiText, AI[ai].label) } },
      icon('copy'), '複製給 AI 簡報用'));
}
