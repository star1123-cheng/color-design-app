// 複製文字：優先使用剪貼簿 API；手機以區網 http 開啟時（非安全環境）改用舊式複製
const toastEl = () => document.getElementById('toast');
let timer = null;

/** 顯示提示（role="status"，螢幕閱讀器會讀出） */
export function toast(message) {
  const el = toastEl();
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  Object.assign(ta.style, { position: 'fixed', top: '0', left: '0', opacity: '0' });
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/**
 * 複製文字並顯示結果。
 * @param {string} text 要複製的內容
 * @param {string} label 提示中顯示的名稱，例如「#78A5CE」
 */
export async function copyText(text, label) {
  let ok = false;
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = false; }
  }
  if (!ok) ok = legacyCopy(text);
  toast(ok ? `已複製 ${label}` : '無法自動複製，請長按色碼手動複製');
  return ok;
}
