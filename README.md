# Correction

協助校正文件內容的 WebApp。

構想源自 speech-to-text 產生的逐字稿：把逐字稿中**因為發音而被錯判的字詞**，依照「校正字集」批次替換成正確的字詞。

- 後端：Node.js + Express（極簡，只負責靜態檔、檔案上傳與字集存檔）
- 前端：jQuery + Materialize CSS + Lodash（皆以 CDN 載入）

![Correction 主頁 — 上傳逐字稿、選擇校正字集、一鍵校正，右側即時顯示校正結果與每條替換的次數](docs/screenshot.png)

---

## 功能

兩個頁面：

| 頁面 | 用途 |
| --- | --- |
| `index.html`（主頁） | 上傳待校正檔案、選擇校正字集、執行校正、複製／下載結果 |
| `correction-data-builder.html` | 編輯／新增校正字集 |

### `index.html` — 校正流程
1. 載入 `correction-data.json`（校正資料來源清單）。
2. 以**拖拉**或**選擇檔案**上傳待校正檔案到 `public/upload/correction/`。
3. 左欄顯示上傳的內容（也可直接貼上文字）。
4. 選擇校正資料來源（correction-data）。
5. 按 **執行校正**。
6. 右欄顯示校正後結果，並列出每條替換的次數。
7. 可 **複製內容**，或以原檔名加上校正時間戳（`yyyyMMddHHmmss`）**下載**。
   - 若原檔名結尾已有時間戳，下載時會**更新**為新的時間戳，而非重複附加。
8. 在 builder 改完字集後，可按 **重新載入** 立即套用最新內容。

### `correction-data-builder.html` — 編輯字集
1. 載入清單後選擇要編輯的校正資料來源。
2. 編輯／新增／刪除條目，或**新增資料來源**（建立新檔並登記到清單）。
3. **儲存** 會寫回伺服器；覆寫前會自動在 `.bak/` 留下帶時間戳的備份。

---

## 校正字集格式

校正字集是 `.json` 陣列，每個條目的 `source` 陣列中的**每個字串**都會被替換成 `target`：

```json
[
  { "source": ["佈署", "布署"], "target": "部署" },
  { "source": ["想象"],         "target": "想像" }
]
```

`correction-data.json` 則是資料來源清單：

```json
[
  {
    "alias": ["示範字集"],
    "file": "sample.json",
    "description": "示範用：常見的同音／形近錯字校正字集"
  }
]
```

> `public/correction-data/sample.json` 為示範資料，可自行替換成你的字集。

---

## 安裝與啟動

需求：Node.js >= 16。

```bash
npm install
npm start
```

預設在 <http://localhost:3000> 啟動（可用環境變數覆寫，例如 `PORT=8080 npm start`）。

開啟瀏覽器到 <http://localhost:3000/> 即為主頁。

---

## 專案結構

```
correction/
├─ app.js                 # Express 進入點：靜態檔 + 上傳 + 字集存檔
├─ routes/
│  ├─ upload.js           # POST /api/upload?folder=correction
│  └─ correction.js       # GET/PUT /api/correction/...（字集存檔，含 .bak 備份）
└─ public/                # 前端（靜態）
   ├─ index.html
   ├─ correction-data-builder.html
   ├─ correction-lib.js   # 校正引擎（字面替換 + 統計 + 檔名時間戳）
   ├─ correction-data.json
   ├─ correction-data/
   │  └─ sample.json
   └─ upload/correction/  # 上傳暫存（內容不納入版控）
```

---

## API

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| `POST` | `/api/upload?folder=correction` | 上傳檔案（multipart 欄位名 `myFiles`）到 `public/upload/correction/` |
| `GET`  | `/api/correction/sources` | 列出 `correction-data/` 下的 `.json` 字集 |
| `PUT`  | `/api/correction/sources/:file` | 寫回單一校正字集（body 為 JSON 陣列） |
| `PUT`  | `/api/correction/list` | 寫回資料來源清單 `correction-data.json` |

寫檔僅限 `public/correction-data/` 下的 `.json`，並做路徑穿越防護；覆寫前自動備份到同層 `.bak/`。

---

## License

[MIT](./LICENSE) © 2026 Scott G.F. Hong
