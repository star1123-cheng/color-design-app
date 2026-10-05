import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePalette, loadPalettes } from '../src/data/schema.js';
import { recommend } from '../src/color/palette.js';

test('序列化再還原後內容完全一致', () => {
  for (const p of recommend('#78A5CE')) {
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
  }
});

test('validatePalette 抓出常見錯誤', () => {
  const [good] = recommend('#78A5CE');
  const bad = structuredClone(good);
  bad.colors.text.hex = '#abcdef';         // 小寫
  delete bad.colors.accent;                 // 缺角色
  bad.checks.contrast.textOnBackground = '12';
  const { valid, errors } = validatePalette(bad);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('text.hex')));
  assert.ok(errors.some((e) => e.includes('accent')));
  assert.ok(errors.some((e) => e.includes('contrast')));
  assert.equal(validatePalette(null).valid, false);
});

test('不認得的 schemaVersion 被安全跳過，不會當機', () => {
  const [good] = recommend('#78A5CE');
  const { palettes, skipped } = loadPalettes([good, { ...good, schemaVersion: 99 }, 'garbage', null]);
  assert.equal(palettes.length, 1);
  assert.equal(skipped.length, 3);
  assert.deepEqual(loadPalettes('not array').palettes, []);
});
