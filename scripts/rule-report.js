// 範例規則報告
// node scripts/rule-report.js            → 只統計「規則集」，用來整理 SPEC 第 4 節建議
// （驗證集通過率的計算在建議寫定後才加入，見檔案後段）

import { buildRows } from './build-palettes.js';
import { RANGES, STYLE_PREFS, checkRole, checkGradient as checkGradientList, checkStyle as checkStyleSrc } from '../src/color/rules.js';

const rows = buildRows();
const ruleSet = rows.filter((r) => r.dataset === '規則集');

const f2 = (v) => v.toFixed(3);
const dH = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const range = (vals) => (vals.length ? `${f2(Math.min(...vals))}–${f2(Math.max(...vals))}（${vals.length} 筆）` : '無資料');

// 依角色收集顏色（排除漸層）
export function collect(rs) {
  const out = { 主色: [], 輔色: [], 底色: [], 字色: [], 點綴色: [] };
  for (const r of rs.filter((x) => !x.gradient)) {
    const p = r.colors[r.roles.indexOf('主色')];
    r.roles.forEach((role, i) => {
      const c = r.colors[i];
      out[role]?.push({ no: r.no, hex: r.hex[i], ...c, state: r.roleState, dH: p ? dH(c.H, p.H) : 0, dL: p ? Math.abs(c.L - p.L) : 0, style: r.style, primary: p ? lchOf(p) : null });
    });
  }
  return out;
}

function ruleSetStats() {
  const g = collect(ruleSet);
  console.log('# 規則集統計（非漸層 %d 組）', ruleSet.filter((r) => !r.gradient).length);
  for (const [role, list] of Object.entries(g)) {
    console.log(`\n## ${role}`);
    console.log(`L ${range(list.map((c) => c.L))}`);
    console.log(`C ${range(list.map((c) => c.C))}`);
    if (role !== '主色') console.log(`與主色 ΔH ${range(list.map((c) => c.dH))}；ΔL ${range(list.map((c) => c.dL))}`);
    for (const c of list) console.log(`  ${c.no} ${c.hex} L${f2(c.L)} C${f2(c.C)} H${c.H.toFixed(1)} ΔH${c.dH.toFixed(1)} ΔL${f2(c.dL)} ${c.state}`);
  }

  console.log('\n## 漸層（規則集）');
  for (const r of ruleSet.filter((x) => x.gradient)) {
    const hs = r.colors.filter((c) => c.C > 0.02).map((c) => c.H);
    const peak = r.colors.reduce((a, c, i) => (c.C > r.colors[a].C ? i : a), 0) + 1;
    const Ls = r.colors.map((c) => c.L);
    console.log(`  ${r.no} L ${f2(Math.max(...Ls))}→${f2(Math.min(...Ls))}；H ${Math.min(...hs).toFixed(1)}–${Math.max(...hs).toFixed(1)}；彩度最高在第 ${peak} 階`);
  }

  console.log('\n## 風格（規則集，非漸層）');
  const styles = [...new Set(ruleSet.filter((r) => !r.gradient).map((r) => r.style))];
  for (const s of styles) {
    const rs = ruleSet.filter((r) => !r.gradient && r.style === s);
    const ps = rs.map((r) => r.colors[r.roles.indexOf('主色')]);
    const bgs = rs.map((r) => r.colors[r.roles.indexOf('底色')]).filter(Boolean);
    const allC = rs.flatMap((r) => r.colors.map((c) => c.C));
    console.log(`${s}（${rs.length} 組：${rs.map((r) => r.no).join('、')}）`);
    console.log(`  主色 H ${ps.map((p) => p.H.toFixed(0)).join('、')}；主色 C ${range(ps.map((p) => p.C))}；全色 C 平均 ${f2(allC.reduce((a, b) => a + b, 0) / allC.length)}`);
    console.log(`  底色 H ${bgs.map((b) => b.H.toFixed(0)).join('、') || '無'}`);
  }
}

// ==================== 範圍定義 ====================
// CURRENT：SPEC v0.2 第 4 節舊值（v0.3 起已被取代，保留作比較）。中性字色的 C 門檻 SPEC 未明訂，沿用階段 0 的假設 0.015。
export const CURRENT = {
  primary: { L: [0.60, 0.82], C: [0.04, 0.16] },
  secondary: [
    { name: '冷暖對比型', L: [0.62, 0.88], C: [0.04, 0.14], dH: [110, 180] },
    { name: '深淺對比型', dLmin: 0.25, C: [0.03, 0.12], dH: [30, 95] },
  ],
  background: [
    { name: '暖底', L: [0.89, 0.97], C: [0.005, 0.035], H: [60, 90] },
    { name: '冷底', L: [0.93, 0.98], C: [0, 0.012], H: [230, 290] },
  ],
  text: { L: [0.20, 0.50], Cmax: 0.065, H: [[210, 240], [38, 50]], neutralC: 0.015 },
  accent: { L: [0.60, 0.78], C: [0.10, 0.14] },
  gradient: [{ name: '單一型', hueSpan: 6, lightMin: 0.94, dark: [0.40, 0.50], peak: 'middle' }],
};

// PROPOSED：只依「規則集」統計整理的建議值（2026-10-05 定稿），v0.3 起已寫入 SPEC，
// 唯一來源改為 src/color/rules.js 的 RANGES（之後不得因驗證集結果修改）
export const PROPOSED = RANGES;

// 漸層由規則集的 7 組判斷：全幅型 4 組（08、55、57、58）、淺色型 3 組（60、61、62）

// ==================== 檢查函式（使用 src/color/rules.js 的驗證器） ====================
const ROLE_KEY = { 主色: 'primary', 輔色: 'secondary', 底色: 'background', 字色: 'text', 點綴色: 'accent' };
const lchOf = (c) => [c.L, c.C, c.H];
const checkColor = (spec, role, c) => checkRole(ROLE_KEY[role], lchOf(c), c.primary, spec).ok;
const checkGradient = (spec, r) => checkGradientList(r.colors.map(lchOf), spec).ok;

// 計算一組資料的通過率；state 指定只算「推論」或「已確認」角色
export function passRate(spec, rs, state) {
  const g = collect(rs.filter((r) => r.roleState === state));
  const byRole = {};
  let pass = 0, total = 0;
  for (const [role, list] of Object.entries(g)) {
    const p = list.filter((c) => checkColor(spec, role, c)).length;
    byRole[role] = [p, list.length];
    pass += p; total += list.length;
  }
  return { pass, total, byRole };
}

export function gradientRate(spec, rs) {
  const gs = rs.filter((r) => r.gradient);
  return [gs.filter((r) => checkGradient(spec, r)).length, gs.length];
}

const pct = (p, t) => (t ? `${p}/${t}（${((p / t) * 100).toFixed(1)}%）` : '0/0（—）');
export function printRates(title, rs) {
  console.log(`\n# ${title}`);
  for (const [name, spec] of [['SPEC v0.2（舊值）', CURRENT], ['SPEC v0.3（現行）', PROPOSED]]) {
    const inf = passRate(spec, rs, '推論');
    const conf = passRate(spec, rs, '已確認');
    const [gp, gt] = gradientRate(spec, rs);
    console.log(`## ${name}`);
    console.log(`推論角色（僅供參考）：${pct(inf.pass, inf.total)}　` + Object.entries(inf.byRole).map(([k, [p, t]]) => `${k} ${pct(p, t)}`).join('、'));
    console.log(`已確認角色：${pct(conf.pass, conf.total)}　` + Object.entries(conf.byRole).filter(([, [, t]]) => t).map(([k, [p, t]]) => `${k} ${pct(p, t)}`).join('、'));
    console.log(`漸層：${pct(gp, gt)}`);
  }
}

ruleSetStats();
printRates('規則集涵蓋率（用於檢查建議是否描述了規則集）', ruleSet);

// ==================== 風格偏好（SPEC 4.6，只依規則集整理） ====================
// 復古（規則集 1 組）、夜間（規則集 2 組）樣本不足，暫不產生規則；漸層另計，不屬於風格。
// 定義已移到 src/color/rules.js 的 STYLE_PREFS（v0.3 寫入 SPEC 4.6）
const checkStyle = (r) => checkStyleSrc(r.style, r.colors.map(lchOf), lchOf(r.colors[r.roles.indexOf('主色')]));

export function printStyleRates(title, rs) {
  console.log(`\n# ${title}（風格偏好）`);
  for (const s of [...Object.keys(STYLE_PREFS), '復古', '夜間']) {
    const list = rs.filter((r) => !r.gradient && r.style === s);
    if (!STYLE_PREFS[s]) { console.log(`${s}：${list.length} 組，樣本不足，暫不產生規則`); continue; }
    const fails = list.filter((r) => !checkStyle(r)).map((r) => r.no);
    console.log(`${s}：${pct(list.length - fails.length, list.length)}${fails.length ? `　未通過 ${fails.join('、')}` : ''}`);
  }
}
printStyleRates('規則集涵蓋率', ruleSet);

// ==================== 驗證集通過率 ====================
// 建議值定稿後才加入。驗證集只用來算通過率，不得依結果回頭修改上面的範圍或移動資料。
const validation = rows.filter((r) => r.dataset === '驗證集');
printRates('驗證集通過率', validation);
for (const [name, spec] of [['SPEC v0.2（舊值）', CURRENT], ['SPEC v0.3（現行）', PROPOSED]]) {
  const detail = [];
  for (const [role, list] of Object.entries(collect(validation))) {
    for (const c of list) if (!checkColor(spec, role, c)) detail.push(`${c.no} ${role} ${c.hex}`);
  }
  for (const r of validation.filter((x) => x.gradient)) if (!checkGradient(spec, r)) detail.push(`${r.no} 漸層`);
  console.log(`${name} 未通過：${detail.join('；')}`);
}
printStyleRates('驗證集通過率', validation);
