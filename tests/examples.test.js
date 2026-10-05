// 範例驗證（SPEC 第 9 節階段 1，門檻暫定、待使用者確認）：
// a. 已確認角色通過率（驗證集）須 100%（樣本 6 筆）
// b. 規則集涵蓋率（含推論與已確認角色）不得低於階段 0 基準 96/107
//    基準來源：docs/rules-extracted.md 第 5.2 節（推論 89/99 ＋ 已確認 7/8）
// 推論角色通過率（驗證集）只列參考，不作為門檻。驗證集只用來算通過率，不得據此修改規則。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRows } from '../scripts/build-palettes.js';
import { checkRole, checkGradient } from '../src/color/rules.js';

const ROLE_KEY = { 主色: 'primary', 輔色: 'secondary', 底色: 'background', 字色: 'text', 點綴色: 'accent' };
const lch = (c) => [c.L, c.C, c.H];

export function rate(rows, state) {
  let pass = 0, total = 0;
  for (const r of rows.filter((x) => !x.gradient && (!state || x.roleState === state))) {
    const p = r.colors[r.roles.indexOf('主色')];
    r.roles.forEach((role, i) => {
      total++;
      if (checkRole(ROLE_KEY[role], lch(r.colors[i]), p && lch(p)).ok) pass++;
    });
  }
  return { pass, total };
}

const rows = buildRows();
const ruleSet = rows.filter((r) => r.dataset === '規則集');
const validation = rows.filter((r) => r.dataset === '驗證集');

test('資料切分固定：規則集 44、驗證集 18', () => {
  assert.equal(ruleSet.length, 44);
  assert.equal(validation.length, 18);
  assert.ok(validation.every((r) => [3, 6, 9].includes(Number(r.no) % 10)));
});

const STAGE0_BASELINE = { pass: 96, total: 107 };

test('a. 已確認角色通過率（驗證集）須 100%（樣本 6 筆）', (t) => {
  const { pass, total } = rate(validation, '已確認');
  t.diagnostic(`已確認角色：${pass}/${total}`);
  assert.equal(total, 6);
  assert.equal(pass, total);
});

test('b. 規則集涵蓋率不得低於階段 0 基準 96/107', (t) => {
  const { pass, total } = rate(ruleSet);
  t.diagnostic(`規則集涵蓋率：${pass}/${total}（基準 ${STAGE0_BASELINE.pass}/${STAGE0_BASELINE.total}）`);
  assert.ok(pass / total >= STAGE0_BASELINE.pass / STAGE0_BASELINE.total, `${pass}/${total}`);
});

test('參考：推論角色通過率（驗證集，不設門檻）', (t) => {
  const { pass, total } = rate(validation, '推論');
  t.diagnostic(`推論角色（僅供參考）：${pass}/${total}`);
  assert.ok(total > 0);
});

test('參考：漸層（規則集涵蓋與驗證集）', (t) => {
  const g = (rs) => rs.filter((r) => r.gradient);
  const ok = (rs) => g(rs).filter((r) => checkGradient(r.colors.map(lch)).ok).length;
  t.diagnostic(`規則集 ${ok(ruleSet)}/${g(ruleSet).length}；驗證集 ${ok(validation)}/${g(validation).length}`);
  assert.ok(g(ruleSet).length > 0);
});
