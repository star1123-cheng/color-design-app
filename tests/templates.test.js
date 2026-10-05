// 範本庫（階段 2.5）：資料與產生腳本一致、格式正確、收錄者通過檢查、不偷偷改色
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, TEMPLATE_COUNT } from '../src/data/templates.js';
import { toPalette, checkTemplate, TEMPLATE_STYLES, SOURCE_SAMPLE, SOURCE_ENGINE } from '../src/data/template-palette.js';
import { validatePalette, ROLES } from '../src/data/schema.js';
import { CONTRAST } from '../src/color/contrast.js';
import { buildTemplates, DISCARDED_IDS } from '../scripts/build-templates.js';
import { buildRows } from '../scripts/build-palettes.js';

test('templates.js 與產生腳本輸出完全一致（沒有手動改色）', () => {
  const built = buildTemplates().map(({ sampleNo, ...t }) => t);
  assert.deepEqual(TEMPLATES, built);
  assert.equal(TEMPLATE_COUNT, TEMPLATES.length);
});

test('非漸層範例扣除使用者捨棄者；編號遞增、不重複，捨棄的編號保留空號', () => {
  const nonGradient = buildRows().filter((r) => !r.gradient).length;
  assert.equal(TEMPLATES.length, nonGradient - DISCARDED_IDS.length);
  const nums = TEMPLATES.map((t) => Number(t.id.slice(2)));
  nums.forEach((n, i) => { if (i) assert.ok(n > nums[i - 1], TEMPLATES[i].id); });
  for (const id of DISCARDED_IDS) assert.equal(TEMPLATES.some((t) => t.id === id), false, id);
  const expected = Array.from({ length: nonGradient }, (_, i) => `T-${String(i + 1).padStart(3, '0')}`).filter((id) => !DISCARDED_IDS.includes(id));
  assert.deepEqual(TEMPLATES.map((t) => t.id), expected);
});

test('格式：五個角色 HEX、風格只用 SPEC 4.6、每個角色都標示來源', () => {
  for (const t of TEMPLATES) {
    for (const r of ROLES) {
      assert.match(t.colors[r], /^#[0-9A-F]{6}$/, `${t.id} ${r}`);
      assert.ok([SOURCE_SAMPLE, SOURCE_ENGINE].includes(t.source[r]), `${t.id} ${r}`);
    }
    assert.ok(TEMPLATE_STYLES.includes(t.style), t.id);
    assert.equal(t.source.primary, SOURCE_SAMPLE, `${t.id} 主色必須來自範例`);
    assert.deepEqual(t.adjusted, [], `${t.id} 目前沒有任何調整`);
  }
});

test('範例色保留原色：標示「範例」的顏色都出現在原範例色票中', () => {
  const rows = buildRows().filter((r) => !r.gradient);
  const sampleSets = rows.map((r) => new Set(r.hex));
  for (const t of TEMPLATES) {
    const fromSample = ROLES.filter((r) => t.source[r] === SOURCE_SAMPLE).map((r) => t.colors[r]);
    assert.ok(sampleSets.some((s) => fromSample.every((hex) => s.has(hex))), `${t.id} 的範例色找不到對應色票`);
  }
});

test('收錄的範本：通過 validatePalette，字色 ≥ 4.5:1、點綴色 ≥ 3:1', () => {
  const included = TEMPLATES.filter((t) => t.status === '收錄');
  assert.ok(included.length > 0);
  for (const t of included) {
    const p = toPalette(t);
    assert.deepEqual(validatePalette(p).errors, [], t.id);
    assert.ok(p.checks.contrast.textOnBackground >= CONTRAST.text, t.id);
    assert.ok(p.checks.contrast.accentOnBackground >= CONTRAST.graphic, t.id);
    assert.deepEqual(checkTemplate(t).blocking, [], t.id);
  }
});

test('待決定的範本：附有未通過原因，且原因與檢查結果一致', () => {
  for (const t of TEMPLATES.filter((x) => x.status === '待決定')) {
    const { blocking } = checkTemplate(t);
    assert.ok(blocking.length > 0, t.id);
    for (const b of blocking) assert.ok(t.issues.includes(b), `${t.id}：${b}`);
  }
});
