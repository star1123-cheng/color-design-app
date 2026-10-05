// 老師模式（SPEC 4.5、4.7）：場景、投影模式、模擬檢視（黑白列印、三種色弱）、字級與版面建議。
// 介面文字以國小高年級看得懂為準（SPEC 7）。
import { h, icon, mount } from './dom.js';
import { SCENES, SCENE_KEYS, typographyLimits, layoutTips } from '../data/presets.js';
import { SIM_TYPES, SIM_LABELS } from '../color/cvd.js';
import { currentTypography } from '../state.js';

const SIM_HINTS = {
  gray: '模擬印成黑白的樣子：主色和輔色要分得出深淺。',
  protan: '模擬紅色弱的人看到的顏色：紅色看起來比較暗、偏黃褐。',
  deutan: '模擬綠色弱的人看到的顏色：紅色和綠色容易混在一起。',
  tritan: '模擬藍色弱的人看到的顏色：藍色和綠色容易混在一起。',
};

/** 場景按鈕與投影模式開關 */
export function renderSceneBar(chips, projectionSwitch, state, { onScene, onProjection }) {
  mount(chips, SCENE_KEYS.map((key) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(state.scene === key),
    on: { click: () => onScene(key) },
  }, SCENES[key].label)));
  projectionSwitch.setAttribute('aria-checked', String(state.projection));
  projectionSwitch.onclick = () => onProjection(!state.projection);
}

/** 模擬檢視：原本的顏色、黑白列印、紅色弱、綠色弱、藍色弱 */
export function renderSimSwitch(chips, hint, simulate, onSim) {
  mount(chips, SIM_TYPES.map((type) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(simulate === type),
    on: { click: () => onSim(type) },
  }, SIM_LABELS[type])));
  hint.hidden = simulate === 'none';
  hint.textContent = SIM_HINTS[simulate] ?? '';
}

/** 字級微調（不低於下限）與版面建議；微調後預覽的字會跟著變大變小 */
export function renderTypography(panel, state, { onAdjust, onReset }) {
  const t = currentTypography(state);
  const lim = typographyLimits(state.scene, state.projection);
  const row = (key, label) => h('div', { class: 'typo-row' },
    h('div', {},
      h('div', { class: 'typo-label' }, label),
      h('div', { class: 'typo-min' }, `最小 ${lim[key].min} ${t.unit}`)),
    h('div', { class: 'stepper' },
      h('button', {
        type: 'button', class: 'btn btn-round', 'aria-label': `${label}字級減 1`,
        disabled: t[key] <= lim[key].min, on: { click: () => onAdjust(key, -1) },
      }, icon('minus')),
      h('span', { class: 'stepper-value', 'aria-live': 'polite' }, `${t[key]} ${t.unit}`),
      h('button', {
        type: 'button', class: 'btn btn-round', 'aria-label': `${label}字級加 1`,
        disabled: t[key] >= lim[key].max, on: { click: () => onAdjust(key, 1) },
      }, icon('plus'))));

  mount(panel,
    h('div', { class: 'typo-head' },
      h('h3', {}, '字級與版面建議'),
      h('span', { class: 'mono-note' }, `${SCENES[state.scene].label}${state.projection ? '・投影' : ''}`)),
    h('p', { class: 'hint typo-hint' }, '按 ＋、－ 調整字級，上面的預覽會跟著變大變小。'),
    row('title', '標題'),
    row('body', '內文'),
    state.typo ? h('button', { type: 'button', class: 'btn typo-reset', on: { click: onReset } }, '回到建議字級') : null,
    h('ul', { class: 'tips' }, layoutTips(state.scene, state.projection).map((tip) => h('li', {}, tip))));
}
