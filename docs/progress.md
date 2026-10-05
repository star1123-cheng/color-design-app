# 進度摘要（progress.md，2026-10-05，階段 5 完成時）

> 階段 4、4B、5 已完成：匯出（HEX、RGB、CSS 變數、oklch()、Google 簡報 12 欄）、收藏（localStorage）、PWA（manifest、sw.js 網路優先、圖示）、
> 複製給 AI 簡報用（YAML／完整提示詞）、audit 加入金鑰與套件檢查、`docs/deploy.md`、`docs/manual-checklist.md`。
> 下方為階段 3 時的紀錄；新增模組：export/formats、export/ai-prompt、data/favorites、ui/export、ui/favorites、scripts/build-icons。

## 已完成
- 階段 0：範例資料化（62 組，規則集 44／驗證集 18）、風格確認，見 `rules-extracted.md`、`palettes.csv`。
- 階段 1：色彩引擎與測試（SPEC v0.3），見 `engine-report.md`。
- 階段 2：基礎 UI＋外觀依設計稿調整；本機預覽 `npm run dev`、介面檢查 `npm run audit`。
- 階段 2.5：範本庫收錄 49 組（另 3 組由使用者決定捨棄），見 `templates-review.md`。已提交 8eacf8e。
- 階段 3：兩種模式功能（尚未提交，待使用者確認）。
  - 老師模式：四個場景、投影模式開關、模擬檢視（原本／黑白列印／紅色弱／綠色弱／藍色弱）、字級微調（不低於 0.8 倍）與版面建議。
  - 大眾模式：六個風格標籤（復古、夜間標示建置中）、圖片取色（本機 k-means）、色票卡 PNG（Web Share，不支援時下載）。
  - 模式切換保留選色；狀態規則集中在 `src/state.js`（純函式，有測試）。
  - 實作假設列在 `rules-changelog.md`「階段 3 實作假設」。

## 各模組對外函式
- color/oklch：hexToOklch、oklchToLinearRgb、hexToRgb、rgbToHex、normalizeHex、isHex、roundOklch、hueDiff、normalizeHue、toOklchString、toRgbString、toHslString
- color/gamut：clampChroma、isInGamut、maxChroma、oklchToHex、quantize
- color/contrast：relativeLuminance、contrastRatio、CONTRAST、bestTextOn、adjustForContrast
- color/rules：RANGES、STYLE_PREFS、INSUFFICIENT_STYLES、checkRole、checkPalette、checkGradient、checkStyle
- color/harmony：createRng、hashString、secondaryCandidates；color/gradient：makeGradient
- color/palette：recommend、makeText、softenPrimary、makeId、checkProjection、PROJECTION、STYLE_HINTS
- color/cvd：simulateCvd、toGrayHex、grayL、checkGrayscale、checkCvdPair、checkCvd、cvdWarning、simulateColors、CVD_*、SIM_*
- color/extract：extractColors、fitSize
- export/card：cardLayout、drawCard、renderCardCanvas、canvasToPng、cardFileName、shareMethod、downloadBlob、shareOrDownload
- data/schema：validatePalette、loadPalettes；data/presets：SCENES、SCENE_PREVIEW、STYLES、typographyFor、typographyLimits、clampTypography、layoutTips、minTextContrast
- data/template-palette：toPalette、checkTemplate、filledRoles；data/templates：TEMPLATES、TEMPLATE_COUNT
- state：createState、pickColor、switchMode、setScene、setProjection、setStyle、adjustTypography、currentTypography、recommendOptions、withTypography
- ui：initPicker、renderPicker、renderCards、ratioBar、renderPreview、renderChecks、renderRoles、copyText、toast、runDomAudit、renderSceneBar、renderSimSwitch、renderTypography、renderStyleChips、renderShareCard、initImagePick
- scripts：build-palettes、rule-report、build-templates、audit、serve（resolveRequest）、demo

## 重要決定與原因
- 第 4 節數值只依規則集整理；驗證集只算通過率，不回頭改規則（避免過度擬合）。
- 驗收：已確認角色 100%、規則集涵蓋率不低於 96/107；推論角色只列參考（推論本身用到門檻，有循環驗證）。
- 規則常數只在 rules.js；測試從 SPEC.md 原文解析預期值，不從程式複製。
- 不載入外部字型、不連網路（SPEC 2、7）；深色模式延後。
- 範本庫：沿用既有色碼、缺角色由引擎補色並標示來源、SPEC 2-7 加例外；docs/design-ref/ 不提交。
- 點綴色未達 3:1 的 T-007、T-033、T-042 由使用者決定捨棄（編號保留空號）。
- 階段 3：推薦排序維持階段 2 算法，避免範本庫引擎補色變色（`tests/templates.test.js` 確認 templates.js 未變）。
- 2026-10-06：推薦的點綴色改取主色相鄰色相（±35°，彩度 ≤ 0.108），避免對比太強而突兀；範本庫產生腳本傳 `accentHue: 'far'` 維持舊算法，已審核的範本不變色。
- 2026-10-06：漸層建議增為 5 種（新增「相近色漸層」），使用者可選用途（整頁背景、橫幅／主視覺、按鈕與標籤、裝飾圖形）與方向（斜角、左到右、上到下、放射）；選定的漸層會附在所有匯出格式與「複製給 AI」。
- 2026-10-06：收藏可一起保存選定的漸層（SPEC 3.1 選填欄位 `gradient`，只存設定、色碼由五色重算）；同一組五色換漸層時更新原收藏。
- 2026-10-06：線上載入慢的原因是 ES Modules 一層一層下載（5 層往返）；`index.html` 加入 `modulepreload` 讓所有程式檔同時下載，`tests/stage4.test.js` 檢查清單完整。
- 2026-10-06：新增「元件配色」：預覽上的元件（標題、按鈕、裝飾、卡片、題號、表頭等，見 `src/data/parts.js`）可改用配色裡的其他顏色或自訂顏色；預覽畫好後再套用，優先於漸層。會存進收藏（SPEC 3.1 選填欄位 `custom`）並附在所有匯出格式與「複製給 AI」（YAML `components`）。

## 已知問題
- 引擎補的點綴色依引擎輔色計算，部分範本觀感與原圖不同。
- 療癒、森系、商務的 STYLE_PREFS.background 用詞未對齊 SPEC（使用者將另行決定）。
- 手機實機、區網模式未實測；01–10 中文色名不在 audit 檢查範圍。
- Web Share 只在手機（安全環境）實測才能確認；電腦瀏覽器與區網 http 會走下載。
- 灰階與色弱檢查未納入排序（待使用者決定）。

## 下一步
- 階段 2.5 捨棄 3 組範本的修改與階段 3 的修改都尚未提交，待使用者確認 `git status`。
- 階段 4（匯出、收藏與 PWA）於新對話開始：先讀本檔、SPEC.md、DESIGN.md。
