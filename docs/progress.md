# 進度摘要（progress.md，2026-10-05，階段 2.5 完成時）

## 已完成
- 階段 0：範例資料化（62 組，規則集 44／驗證集 18）、風格確認，見 `rules-extracted.md`、`palettes.csv`。
- 階段 1：色彩引擎與測試（SPEC v0.3），見 `engine-report.md`。
- 階段 2：基礎 UI＋外觀依設計稿調整；本機預覽 `npm run dev`、介面檢查 `npm run audit`。
- 階段 2.5：範本庫 52 組（收錄 49、待決定 3），見 `templates-review.md`。npm test 64 項。

## 各模組對外函式
- color/oklch：hexToOklch、oklchToLinearRgb、hexToRgb、rgbToHex、normalizeHex、isHex、roundOklch、hueDiff、normalizeHue、toOklchString、toRgbString、toHslString
- color/gamut：clampChroma、isInGamut、maxChroma、oklchToHex、quantize
- color/contrast：relativeLuminance、contrastRatio、CONTRAST、bestTextOn、adjustForContrast
- color/rules：RANGES、STYLE_PREFS、INSUFFICIENT_STYLES、checkRole、checkPalette、checkGradient、checkStyle
- color/harmony：createRng、hashString、secondaryCandidates；color/gradient：makeGradient
- color/palette：recommend、makeText、softenPrimary、makeId
- data/schema：validatePalette、loadPalettes；data/presets：SCENES、STYLES、typographyFor、minTextContrast
- data/template-palette：toPalette、checkTemplate、filledRoles；data/templates：TEMPLATES、TEMPLATE_COUNT
- ui：initPicker、renderPicker、renderCards、ratioBar、renderPreview、renderChecks、renderRoles、copyText、toast、runDomAudit
- scripts：build-palettes、rule-report、build-templates、audit、serve（resolveRequest）、demo

## 重要決定與原因
- 第 4 節數值只依規則集整理；驗證集只算通過率，不回頭改規則（避免過度擬合）。
- 驗收：已確認角色 100%、規則集涵蓋率不低於 96/107；推論角色只列參考（推論本身用到門檻，有循環驗證）。
- 規則常數只在 rules.js；測試從 SPEC.md 原文解析預期值，不從程式複製。
- 不載入外部字型、不連網路（SPEC 2、7）；深色模式延後。
- 範本庫：沿用既有色碼、缺角色由引擎補色並標示來源、SPEC 2-7 加例外；docs/design-ref/ 不提交。

## 已知問題
- 範本 T-007、T-033、T-042 點綴色未達 3:1，待使用者決定（收錄／調整／捨棄）。
- 引擎補的點綴色依引擎輔色計算，部分範本觀感與原圖不同。
- 療癒、森系、商務的 STYLE_PREFS.background 用詞未對齊 SPEC（使用者將另行決定）。
- 手機實機、區網模式未實測；01–10 中文色名不在 audit 檢查範圍。

## 下一步
- 使用者決定 3 組待決定範本；之後等待階段 3 的 SPEC 範圍。
