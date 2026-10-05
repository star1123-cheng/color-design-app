# 部署說明（GitHub Pages）

## 先知道的事

- 這個網站是**純靜態檔案**（HTML、CSS、JavaScript），沒有後端、沒有金鑰、沒有網路請求，適合放在 GitHub Pages。
- GitHub Pages **無法保護私鑰與環境變數**：放上去的每個檔案任何人都看得到。本專案本來就不使用任何金鑰；日後若要加入需要金鑰的功能，不能放在這裡，要改用 Netlify Functions 或 Cloud Functions 代理。
- 免費帳號的 GitHub Pages 只能用**公開（Public）repository**。公開代表 `SPEC.md`、`docs/`、測試等所有提交的檔案都會被看到。
- `reference/`（他人創作的範例圖片）已列入 `.gitignore`，不會上傳。

## 部署前檢查（每次都做）

```bash
npm test
```

```bash
npm run audit
```

兩個都要全部通過。`audit` 會檢查金鑰樣式字串、`.env` 與金鑰檔沒有被 Git 追蹤、沒有 runtime dependencies、沒有外部網址與網路請求。

接著看要提交的檔案：

```bash
git status
```

確認清單裡沒有 `reference/`、`.env`、`*.pem`、`*.key`、`docs/design-ref/`。

## 第一次部署

1. 在 GitHub 建立 repository（例如 `color-design-app`），可見度選 **Public**。
2. 把程式推上去（分支 `master`）。
3. 到 repository 的 **Settings → Pages**：
   - **Source**：選 `Deploy from a branch`。
   - **Branch**：選 `master`，資料夾選 `/ (root)`，按 **Save**。
4. 等 1–2 分鐘，頁面上方會出現網址，格式是 `https://<帳號>.github.io/color-design-app/`。

### 為什麼選 root 資料夾

`index.html`、`manifest.webmanifest`、`sw.js`、`src/`、`icons/` 都在專案最上層，而且全部使用**相對路徑**（例如 `./sw.js`、`src/main.js`），所以放在 `/color-design-app/` 這種子路徑也能正常運作，不需要建置步驟。

### 會被公開但網站用不到的檔案

`docs/`、`tests/`、`scripts/` 也會出現在網站上（例如 `.../docs/progress.md`）。它們不含機敏資料，但若不想公開，可以改用「只放網站檔案的分支」：

1. 建立 `gh-pages` 分支，只保留 `index.html`、`manifest.webmanifest`、`sw.js`、`src/`、`icons/`。
2. Settings → Pages 的 Branch 改選 `gh-pages`、`/ (root)`。

## 更新網站

1. 修改程式，跑 `npm test` 與 `npm run audit`。
2. 如果**新增或刪除**了 `src/` 或 `icons/` 的檔案：更新 `sw.js` 的 `PRECACHE` 清單，並把 `CACHE` 的版本號加 1（例如 `color-design-app-v2`）。`npm test` 會檢查清單有沒有漏。
3. 提交並推上去，GitHub Pages 會自動重新部署。

Service Worker 採「網路優先」：有網路時一律拿最新檔案，所以更新後重新整理就會看到新版。

## 回退到上一個穩定版本

每個階段都有 commit，出問題時：

```bash
git log --oneline
```

找到上一個正常的 commit 編號，用 `git revert <編號>` 產生一個「還原」的新 commit 再推上去（不會改寫歷史，比較安全）。

## 驗證離線可用

1. 用電腦 Chrome 打開部署後的網址（或本機 `npm run dev` 後開 `http://localhost:8080/`）。
2. 按 F12 → **Application** → **Service Workers**，確認狀態是 `activated and is running`。
3. **Application → Cache storage → color-design-app-v1**，應該有 40 個檔案左右。
4. 切到 **Network** 分頁，把 `No throttling` 改成 **Offline**，按 F5 重新整理。
5. 網頁仍能完整打開、可以選色與推薦，就代表離線可用。測完記得改回 `No throttling`。

本機也可以用更直接的方法：開過一次網頁後，在終端機按 Ctrl + C 關掉 `npm run dev`，再重新整理網頁，應該仍能使用（開發時已用這個方法實測通過）。

> 手機以區網 `http://192.168.x.x` 開啟時不是安全環境，瀏覽器不允許 Service Worker，所以區網測試時不會有離線功能；部署到 GitHub Pages（https）後才有。
