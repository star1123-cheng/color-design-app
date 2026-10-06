// 收藏（SPEC 2-5、3.1）：只用 localStorage，所有讀寫都 try/catch。
// storage 以參數傳入（預設 globalThis.localStorage），方便在 Node 測試。
// 資料損毀、不認得的 schemaVersion 一律跳過並回報，不讓程式當機。
import { loadPalettes, validatePalette } from './schema.js';
import { makeId } from '../color/palette.js';
import { gradientList } from '../color/gradient.js';

export const STORAGE_KEY = 'color-design-app:favorites';
export const MAX_FAVORITES = 50; // （假設）上限，避免 localStorage 爆量

const getStorage = (storage) => {
  try { return storage === undefined ? globalThis.localStorage : storage; } catch { return null; } // 部分瀏覽器存取 localStorage 本身就會丟錯
};

/**
 * 讀取收藏。
 * @returns {{ palettes: object[], skipped: number, error: string|null }}
 */
export function loadFavorites(storage) {
  const s = getStorage(storage);
  if (!s) return { palettes: [], skipped: 0, error: '這個瀏覽器無法使用收藏（可能是無痕模式）' };
  let raw;
  try { raw = s.getItem(STORAGE_KEY); } catch { return { palettes: [], skipped: 0, error: '無法讀取收藏' }; }
  if (raw === null || raw === '') return { palettes: [], skipped: 0, error: null }; // 空資料
  let data;
  try { data = JSON.parse(raw); } catch { return { palettes: [], skipped: 0, error: '收藏資料損毀，已略過' }; }
  const { palettes, skipped } = loadPalettes(data);
  const notArray = skipped.length === 1 && skipped[0].index === -1;
  return {
    palettes,
    skipped: notArray ? 0 : skipped.length,
    error: notArray ? '收藏資料損毀，已略過' : (skipped.length ? `有 ${skipped.length} 筆收藏格式不符，已略過` : null),
  };
}

function write(s, list) {
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(list));
    return null;
  } catch {
    return '無法儲存收藏（空間不足或瀏覽器不允許）';
  }
}

/** 同一組五色視為同一筆 */
const signature = (p) => ['primary', 'secondary', 'background', 'text', 'accent'].map((r) => p.colors[r].hex).join('');
/** 漸層與元件配色的設定（比較是否相同用） */
const extrasSig = (p) => JSON.stringify([
  gradientList(p.gradient).map((g) => [g.key, g.target, g.dir]),
  Object.entries(p.custom ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)),
]);

/** 把 src 的漸層與元件配色設定套到 p（src 沒有的欄位就移除） */
function withExtras(p, src) {
  const { gradient: _g, custom: _c, ...rest } = p;
  const g = gradientList(src.gradient); // 一個時存單一物件（舊版格式），多個時存陣列
  const custom = src.custom && Object.keys(src.custom).length ? { ...src.custom } : null;
  return {
    ...rest,
    ...(g.length ? { gradient: g.length === 1 ? g[0] : g } : {}),
    ...(custom ? { custom } : {}),
  };
}

/**
 * 加入收藏（放在最前面）。
 * @returns {{ ok: boolean, palettes: object[], message: string }}
 */
export function addFavorite(palette, storage) {
  const s = getStorage(storage);
  if (!s) return { ok: false, palettes: [], message: '這個瀏覽器無法使用收藏（可能是無痕模式）' };
  const { palettes } = loadFavorites(s);
  const same = palettes.find((p) => signature(p) === signature(palette));
  if (same) {
    // 同一組五色、漸層或元件配色不同：更新那筆收藏的設定，不另存一筆
    if (extrasSig(same) === extrasSig(palette)) return { ok: false, palettes, message: '這組配色已經在收藏裡了' };
    const updated = withExtras(same, palette);
    if (!validatePalette(updated).valid) return { ok: false, palettes, message: '這組配色格式不符，無法收藏' };
    const next = palettes.map((p) => (p === same ? updated : p));
    const err = write(s, next);
    if (err) return { ok: false, palettes, message: err };
    return { ok: true, palettes: next, message: '已更新這組收藏的漸層與元件配色' };
  }
  if (palettes.length >= MAX_FAVORITES) return { ok: false, palettes, message: `收藏最多 ${MAX_FAVORITES} 組，請先刪除一些` };
  const item = withExtras({ ...structuredClone(palette), id: makeId() }, palette);
  if (!validatePalette(item).valid) return { ok: false, palettes, message: '這組配色格式不符，無法收藏' };
  const next = [item, ...palettes];
  const err = write(s, next);
  return err ? { ok: false, palettes, message: err } : { ok: true, palettes: next, message: '已加入收藏' };
}

/** 刪除收藏 */
export function removeFavorite(id, storage) {
  const s = getStorage(storage);
  if (!s) return { ok: false, palettes: [], message: '無法使用收藏' };
  const { palettes } = loadFavorites(s);
  const next = palettes.filter((p) => p.id !== id);
  const err = write(s, next);
  return err ? { ok: false, palettes, message: err } : { ok: true, palettes: next, message: '已刪除收藏' };
}

/** 改名（名稱去頭尾空白、最多 30 字） */
export function renameFavorite(id, name, storage) {
  const s = getStorage(storage);
  if (!s) return { ok: false, palettes: [], message: '無法使用收藏' };
  const { palettes } = loadFavorites(s);
  const clean = String(name ?? '').trim().slice(0, 30);
  if (!clean) return { ok: false, palettes, message: '名稱不能空白' };
  const next = palettes.map((p) => (p.id === id ? { ...p, name: clean } : p));
  const err = write(s, next);
  return err ? { ok: false, palettes, message: err } : { ok: true, palettes: next, message: '已改名' };
}
