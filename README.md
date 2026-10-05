# 配色推薦 PWA

選一個顏色，系統自動推薦整組搭配色（主色、輔色、底色、字色、點綴色），並提供簡報與網頁的即時預覽。分為「老師模式」與「大眾模式」。

完整規格見 [SPEC.md](SPEC.md)，介面設計規範見 [DESIGN.md](DESIGN.md)。

## 技術原則

- 純前端：HTML、CSS、原生 JavaScript（ES Modules），不使用框架。
- 執行期套件數量為 0；目前也沒有任何開發期套件。
- 沒有後端、沒有 API Key、沒有任何網路請求。
- 測試使用 Node.js 內建的 `node:test`。

## 環境需求

- Node.js 20 以上（開發時使用 v24.19.0）。

## 常用指令

```bash
npm test
```

```bash
node scripts/demo.js "#78A5CE"
```

```bash
node scripts/build-palettes.js
```

```bash
node scripts/rule-report.js
```

```bash
npm run dev
```

```bash
npm run audit
```

- `npm run dev`：啟動本機預覽，用瀏覽器開 `http://localhost:8080/`。停止請在終端機按 Ctrl + C。
- `npm run dev:lan`：讓同一個 Wi-Fi 的手機也能開（終端機會列出 `http://192.168.x.x:8080/` 之類的網址）。開著時同網路的任何人都看得到，用完請立刻按 Ctrl + C。
- `npm run audit`：介面靜態檢查（文字對比度、觸控目標、reference/、原始名稱、innerHTML、外部網址）。
- 瀏覽器實測：網址加上 `?audit=1`（例如 `http://localhost:8080/?audit=1`），按 F12 開 Console 看結果（對比度、觸控目標、文字截斷、橫向捲軸）。
- 預覽伺服器只提供 `index.html` 與 `src/`，`reference/`、`docs/`、`.git/` 都讀不到。
- `npm test`：執行全部測試（不需安裝任何套件）。
- `demo.js`：在終端機印出推薦結果；可加場景（`slides`、`worksheet`、`webpage`、`poster`）與 `--projection`。
- `build-palettes.js`：重新產生 `docs/palettes.csv`（範例色票資料表）。
- `rule-report.js`：輸出規則集統計與驗證集通過率。
- `node scripts/build-templates.js`：重新產生範本庫 `src/data/templates.js`（只用既有色碼，不讀 reference/）；審查清單見 `docs/templates-review.md`。

## 資料夾說明

- `index.html`、`src/main.js`、`src/ui/`：介面（大眾模式為預設）。
- `src/color/`：色彩引擎（色彩換算、色域修正、對比度、配色推薦、漸層、範圍驗證）。
- `src/data/`：資料格式驗證與場景預設。
- `tests/`：`node:test` 測試。
- `scripts/`：示範與範例資料整理腳本。
- `docs/`：規則整理、引擎報告、規則修改紀錄、部署說明。
- `reference/`：範例圖片，**只供內部參考，已列入 `.gitignore`，不得提交或複製到其他資料夾**。

## 目前進度

- [x] 階段 0：初始化與範例資料化（見 `docs/rules-extracted.md`）
- [x] 階段 1：色彩引擎與測試（見 `docs/engine-report.md`）
- [ ] 階段 2：基礎 UI（已實作，待使用者驗收）
