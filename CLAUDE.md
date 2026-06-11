# correction — Session context

協助校正純文字（speech-to-text 逐字稿等）的 WebApp：依「校正字集」把因發音被錯判的字詞批次替換成正確字詞。純前端引擎 + 極簡 Express 後端。

本 app 屬於 **nodeapp WebApp 家族**；共同規範與流程在
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md` 規範、`WORKFLOW.md` 流程）。**改動前請先讀那兩份，照其中 canon 做。**

## 結構

```
app.js                         # Express 入口：port 3000；/ → 302 /apps/correction/
routes/upload.js               # POST /api/upload?folder=correction（共用最小版）
routes/correction.js           # GET/PUT /api/correction/...（存校正字集，含 .bak 備份）
public/apps/correction/        # 前端 + 資料（服務於 /apps/correction/）
├─ index.html · correction.css · correction.js · correction-lib.js   # 主頁（校正）
├─ correction-data-builder.html · builder.css · builder.js           # 第二頁（編字集）
├─ side-tool.css · i18n.js · locales/{zh-Hant,en,ja}.js
├─ correction-data.json        # 字集清單
└─ correction-data/sample.json # 校正字集（前端讀、builder 經 routes/correction.js 寫）
public/upload/correction/      # 上傳暫存（內容不進版控）
```

## 執行 / 驗證

```bash
npm install && node app.js     # → http://localhost:3000/apps/correction/
```

## 本 app 的 canon 重點

- **核心引擎** `correction-lib.js`：純邏輯、零依賴、不碰 DOM（`window.CorrectionLib`）；UI 只是它的外殼。
- **相對路徑**：前端對資料用相對路徑（`./correction-data.json`、`./correction-data/`），整包前端 + 資料同在 `public/apps/correction/`。
- **i18n**：`i18n.js` 引擎 + `locales/*.js`，`data-i18n` 屬性，預設 `zh-Hant`；兩頁皆三語。
- **主題**：CSS 變數 light/dark，預設 dark、accent 沿用 teal 品牌色，`<head>` 有防閃爍 inline script；index/builder 共用 `localStorage('correction-theme')`。
- **API 信封**：一律 `{ ok }`。
