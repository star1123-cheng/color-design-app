// 階段 3：色票卡 PNG 的版面、繪製與「分享或下載」判斷（SPEC 4.6 第 3 點）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardLayout, drawCard, cardFileName, shareMethod, shareOrDownload, CARD_SIZE } from '../src/export/card.js';
import { recommend } from '../src/color/palette.js';
import { contrastRatio, CONTRAST } from '../src/color/contrast.js';
import { TEMPLATES } from '../src/data/templates.js';
import { toPalette } from '../src/data/template-palette.js';

const [palette] = recommend('#78A5CE', { mode: 'public', style: '清新' });

test('版面：五個角色各有色票圓與大寫 HEX，比例條為 60／18／12／10', () => {
  const { width, height, items } = cardLayout(palette);
  assert.deepEqual({ width, height }, CARD_SIZE);
  const circles = items.filter((i) => i.type === 'circle');
  assert.deepEqual(circles.map((c) => c.role), ['primary', 'secondary', 'background', 'text', 'accent']);
  circles.forEach((c) => assert.equal(c.fill, palette.colors[c.role].hex));
  const texts = items.filter((i) => i.type === 'text').map((i) => i.text);
  for (const c of Object.values(palette.colors)) assert.ok(texts.includes(c.hex), c.hex);
  assert.ok(texts.includes('風格：清新'));
  const bar = items.find((i) => i.type === 'bar');
  assert.deepEqual(bar.segments.map((s) => s.pct), [60, 18, 12, 10]);
});

test('版面：所有元素都在卡片範圍內；字都畫在底色上且對比 ≥ 4.5:1', () => {
  const { width, height, items } = cardLayout(palette);
  const bg = items[0];
  assert.equal(bg.fill, palette.colors.background.hex);
  for (const it of items) {
    if (it.type === 'text') {
      assert.ok(it.x >= 0 && it.x <= width && it.y > 0 && it.y < height, it.text);
      assert.ok(contrastRatio(it.fill, bg.fill) >= CONTRAST.text, it.text);
    }
    if (it.type === 'circle') assert.ok(it.cx - it.r >= 0 && it.cy + it.r <= height);
  }
});

test('範本（收錄者）也能產生色票卡，字色對底色 ≥ 4.5:1', () => {
  for (const t of TEMPLATES.filter((x) => x.status === '收錄')) {
    const { items } = cardLayout(toPalette(t));
    const texts = items.filter((i) => i.type === 'text');
    texts.forEach((i) => assert.ok(contrastRatio(i.fill, items[0].fill) >= CONTRAST.text, t.id));
  }
});

test('老師模式的卡片副標顯示場景', () => {
  const [p] = recommend('#78A5CE', { mode: 'teacher', scene: 'worksheet' });
  const texts = cardLayout(p, { sceneLabel: '學習單' }).items.filter((i) => i.type === 'text').map((i) => i.text);
  assert.ok(texts.includes('場景：學習單'));
});

test('drawCard：依版面呼叫 Canvas API（以假的 context 記錄）', () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (target, k) => (k in target ? target[k] : (...args) => calls.push([k, ...args])),
    set: (target, k, v) => { calls.push([`set:${String(k)}`, v]); return true; },
  });
  drawCard(ctx, cardLayout(palette));
  const filled = calls.filter(([k]) => k === 'fillText').map(([, t]) => t);
  assert.ok(filled.includes(palette.colors.primary.hex));
  assert.equal(calls.filter(([k]) => k === 'arc').length, 5);
  assert.ok(calls.some(([k]) => k === 'clip'));
});

test('檔名只用英數：palette-主色.png', () => {
  assert.equal(cardFileName(palette), `palette-${palette.colors.primary.hex.slice(1)}.png`);
  assert.match(cardFileName(palette), /^palette-[0-9A-F]{6}\.png$/);
});

const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });

test('shareMethod：支援分享檔案時用 share，否則改為下載', () => {
  assert.equal(shareMethod({ share() {}, canShare: () => true }, file), 'share');
  assert.equal(shareMethod({ share() {}, canShare: () => false }, file), 'download');
  assert.equal(shareMethod({ share() {} }, file), 'download');            // 沒有 canShare
  assert.equal(shareMethod({}, file), 'download');                        // 電腦瀏覽器常見
  assert.equal(shareMethod(undefined, file), 'download');
  assert.equal(shareMethod({ share() {}, canShare: () => { throw new Error('x'); } }, file), 'download');
});

/** 假的 document 與 URL：記錄下載動作 */
function fakeEnv() {
  const log = [];
  const doc = {
    createElement: () => ({ click() { log.push(['click', this.download, this.href]); }, remove() {} }),
    body: { append() {} },
  };
  const urlApi = { createObjectURL: () => 'blob:local/1', revokeObjectURL: () => log.push(['revoke']) };
  return { log, doc, urlApi };
}

test('shareOrDownload：不支援分享 → 下載 PNG', async () => {
  const { log, doc, urlApi } = fakeEnv();
  const r = await shareOrDownload(new Blob([new Uint8Array([1])]), 'palette-78A5CE.png', { nav: {}, doc, urlApi });
  assert.equal(r, 'downloaded');
  assert.deepEqual(log[0], ['click', 'palette-78A5CE.png', 'blob:local/1']);
});

test('shareOrDownload：支援分享 → 用 Web Share 傳 PNG 檔案；使用者取消不下載；分享失敗改下載', async () => {
  const { log, doc, urlApi } = fakeEnv();
  let shared = null;
  const nav = { canShare: () => true, share: async (data) => { shared = data; } };
  assert.equal(await shareOrDownload(new Blob([new Uint8Array([1])]), 'p.png', { nav, doc, urlApi }), 'shared');
  assert.equal(shared.files[0].name, 'p.png');
  assert.equal(shared.files[0].type, 'image/png');
  assert.equal(shared.url, undefined, '不附網址');

  const abort = { canShare: () => true, share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); } };
  assert.equal(await shareOrDownload(new Blob([]), 'p.png', { nav: abort, doc, urlApi }), 'cancelled');
  assert.equal(log.length, 0);

  const fail = { canShare: () => true, share: async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }); } };
  assert.equal(await shareOrDownload(new Blob([]), 'p.png', { nav: fail, doc, urlApi }), 'downloaded');
});
