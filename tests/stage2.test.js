// 階段 2：預覽伺服器白名單、非安全環境的 id 備援、色碼清單、介面靜態檢查
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveRequest } from '../scripts/serve.js';
import { makeId, recommend } from '../src/color/palette.js';
import { hexListText } from '../src/ui/roles.js';

test('預覽伺服器：只提供 index.html 與 src/ 的網頁檔', () => {
  assert.equal(resolveRequest('/'), 'index.html');
  assert.equal(resolveRequest('/index.html'), 'index.html');
  assert.equal(resolveRequest('/src/main.js?audit=1'), 'src/main.js');
  assert.equal(resolveRequest('/src/ui/styles.css'), 'src/ui/styles.css');
});

test('預覽伺服器：拒絕 reference/、路徑穿越、隱藏檔與其他資料夾', () => {
  for (const p of [
    '/reference/manifest.csv', '/reference/01_x.jpg', '/src/../reference/manifest.csv',
    '/%2e%2e/SPEC.md', '/src/%2e%2e/%2e%2e/SPEC.md', '/..%5cSPEC.md', '/.git/config', '/src/.hidden.js',
    '/SPEC.md', '/docs/palettes.csv', '/package.json', '/scripts/serve.js', '/src/data/notes.txt', '/%E0%A4%A',
  ]) {
    assert.equal(resolveRequest(p), null, p);
  }
});

test('makeId：沒有 randomUUID 時（手機區網 http）改用 getRandomValues，格式仍為 UUID v4', () => {
  const fake = { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) & 0xff; return a; } };
  const id = makeId(fake);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(makeId(), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('色碼清單：五個角色、大寫 6 碼 HEX', () => {
  const [p] = recommend('#78A5CE');
  const lines = hexListText(p).split('\n');
  assert.equal(lines.length, 5);
  assert.ok(lines.every((l) => /#[0-9A-F]{6}$/.test(l)));
  assert.ok(lines[0].startsWith('主色') && lines[0].endsWith(p.colors.primary.hex));
});

test('scripts/audit.js 對目前的介面檔案全部通過', () => {
  const script = fileURLToPath(new URL('../scripts/audit.js', import.meta.url));
  let out;
  try {
    out = execFileSync(process.execPath, [script], { encoding: 'utf8' });
  } catch (e) {
    assert.fail(`audit.js 未通過：\n${e.stdout ?? e.message}`);
  }
  assert.match(out, /全部通過/);
});
