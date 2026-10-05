// 選色區：明度滑桿（OKLCH L，保持 C 與 H）；「輸入色碼」展開原生 input type="color" 與色碼輸入框
import { hexToOklch, normalizeHex, isHex, toOklchString } from '../color/oklch.js';
import { oklchToHex } from '../color/gamut.js';

const $ = (id) => document.getElementById(id);
const L_MIN = 20, L_MAX = 95;
const toSlider = (L) => Math.min(L_MAX, Math.max(L_MIN, Math.round(L * 100)));

/**
 * @param {{ onPick: (hex: string, opts: { rebase: boolean }) => void, getBase: () => number[] }} handlers
 */
export function initPicker({ onPick, getBase }) {
  const colorInput = $('color-input');
  const hexInput = $('hex-input');
  const slider = $('lightness');
  const err = $('hex-error');
  const toggle = $('hex-toggle');
  const row = $('hex-row');

  toggle.addEventListener('click', () => {
    const open = row.hidden;
    row.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) hexInput.focus();
  });

  colorInput.addEventListener('input', () => onPick(normalizeHex(colorInput.value), { rebase: true }));

  const tryHex = (commit) => {
    const raw = hexInput.value.trim();
    const v = raw.startsWith('#') ? raw : `#${raw}`;
    const ok = /^#[0-9a-f]{6}$/i.test(v) && isHex(v);
    hexInput.setAttribute('aria-invalid', String(!ok && commit));
    err.hidden = ok || !commit;
    if (ok) onPick(normalizeHex(v), { rebase: true });
  };
  hexInput.addEventListener('input', () => { if (hexInput.value.trim().replace('#', '').length === 6) tryHex(false); });
  hexInput.addEventListener('change', () => tryHex(true));

  slider.addEventListener('input', () => {
    const [, C, H] = getBase();
    onPick(oklchToHex([Number(slider.value) / 100, C, H]), { rebase: false });
  });
}

/** 依目前狀態更新選色區的顯示 */
export function renderPicker({ hex, softened }) {
  const lch = hexToOklch(hex);
  $('focus-swatch').style.background = hex;
  $('focus-hex').textContent = hex;
  $('focus-sub').textContent = softened ? `${toOklchString(lch)}｜主色已柔化` : toOklchString(lch);
  $('color-input').value = hex.toLowerCase();
  const hexInput = $('hex-input');
  if (document.activeElement !== hexInput) hexInput.value = hex;
  hexInput.setAttribute('aria-invalid', 'false');
  $('hex-error').hidden = true;
  const slider = $('lightness');
  slider.value = String(toSlider(lch[0]));
  slider.setAttribute('aria-valuetext', `明度 L ${lch[0].toFixed(2)}`);
  $('lightness-value').textContent = `L ${lch[0].toFixed(2)}`;
}
