// 匯出區（SPEC 第 6 節、6.1）：切換格式、預覽文字、一鍵複製。
// 老師模式另有「複製給 AI 簡報用」（YAML 設計規格｜完整提示詞）；大眾模式預設不顯示（SPEC 6.1）。
import { h, icon, mount } from './dom.js';
import { copyText } from './copy.js';
import { hexList, rgbList, cssVariables, cssOklch, slidesThemeText } from '../export/formats.js';
import { toYaml, toFullPrompt } from '../export/ai-prompt.js';

export const FORMATS = {
  hex: { label: 'HEX', make: hexList, copied: '全部 5 個色碼' },
  rgb: { label: 'RGB', make: rgbList, copied: 'RGB 清單' },
  css: { label: 'CSS 變數', make: cssVariables, copied: 'CSS 變數' },
  oklch: { label: 'oklch()', make: cssOklch, copied: 'oklch() 版本' },
  slides: { label: 'Google 簡報', make: slidesThemeText, copied: 'Google 簡報主題色' },
};
export const MODE_FORMATS = { teacher: ['hex', 'css', 'oklch', 'slides'], public: ['hex', 'rgb', 'css', 'oklch'] };
const AI = { yaml: { label: 'YAML 設計規格', make: toYaml }, prompt: { label: '完整提示詞', make: toFullPrompt } };

const seg = (label, options, current, onPick) => h('div', { class: 'chips chips-wrap', role: 'group', 'aria-label': label },
  options.map(([key, text]) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(current === key), on: { click: () => onPick(key) },
  }, text)));

/**
 * @param {HTMLElement} panel
 * @param {object} palette SPEC 3.1 配色（老師模式含字級微調）
 * @param {{ mode: string, format: string, aiFormat: string }} st
 * @param {{ onFormat: (f: string) => void, onAiFormat: (f: string) => void }} handlers
 */
export function renderExport(panel, palette, st, { onFormat, onAiFormat }) {
  const keys = MODE_FORMATS[st.mode] ?? MODE_FORMATS.public;
  const format = keys.includes(st.format) ? st.format : 'hex';
  const text = FORMATS[format].make(palette);
  const blocks = [
    h('div', { class: 'ratio-head' }, h('h3', {}, '匯出'), h('span', { class: 'mono-note' }, FORMATS[format].label)),
    seg('匯出格式', keys.map((k) => [k, FORMATS[k].label]), format, onFormat),
    h('pre', { class: 'code', 'aria-label': `${FORMATS[format].label}內容` }, text),
    h('button', { type: 'button', class: 'btn btn-primary', on: { click: () => copyText(text, FORMATS[format].copied) } },
      icon('copy'), `複製 ${FORMATS[format].label}`),
  ];

  if (st.mode === 'teacher') {
    const ai = AI[st.aiFormat] ? st.aiFormat : 'yaml';
    const aiText = AI[ai].make(palette);
    blocks.push(
      h('div', { class: 'ratio-head ai-head' }, h('h3', {}, '複製給 AI 簡報用'), h('span', { class: 'mono-note' }, 'ChatGPT・Claude・Gemini')),
      h('p', { class: 'hint' }, '把配色和字級規格貼給 AI，請它照著做簡報。「完整提示詞」可以直接貼上，再把主題改成你的。'),
      seg('AI 簡報格式', Object.entries(AI).map(([k, v]) => [k, v.label]), ai, onAiFormat),
      h('pre', { class: 'code', 'aria-label': `${AI[ai].label}內容` }, aiText),
      h('button', { type: 'button', class: 'btn btn-primary', on: { click: () => copyText(aiText, AI[ai].label) } },
        icon('copy'), '複製給 AI 簡報用'),
    );
  }
  mount(panel, ...blocks);
}
