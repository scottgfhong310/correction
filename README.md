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
    "alias": "示範字集",
    "file": "sample.json",
    "description": "示範用：常見的同音／形近錯字校正字集"
  }
]
```

> `public/correction-data/sample.json` 為示範資料，可自行替換成你的字集。

---

## 介面語言（i18n）

介面支援 **繁體中文 / English**，右上角可即時切換，選擇會記在瀏覽器（`localStorage`）。也可用網址參數強制語言：`?lang=en` 或 `?lang=zh-Hant`。

- 語系字典與切換邏輯都在 `public/i18n.js`（無相依套件）；新增語言＝在字典加一組鍵。
- 校正字集本身屬於**資料內容**，不會被翻譯。
- 目前 `index.html` 已完整雙語；`correction-data-builder.html` 之後再補。

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

## 校正引擎：`CorrectionLib`

`public/correction-lib.js` 是這個專案的核心——一個**不依賴任何套件**（只用原生 `fetch`）的純前端校正引擎。載入後會掛在全域 `window.CorrectionLib`，可單獨抽出，套用到任何需要「字集替換」的頁面。

```html
<script src="correction-lib.js"></script>
<script>
  // 直接給規則套用（不需要伺服器）
  var rules = [
    { source: ["佈署", "布署"], target: "部署" },
    { source: ["想象"],         target: "想像" }
  ];
  var r = CorrectionLib.apply("儘快佈署，想象很好", rules);
  console.log(r.text);   // → "儘快部署，想像很好"
  console.log(r.total);  // → 2
  console.log(r.stats);  // → [{source:"佈署",target:"部署",count:1}, {source:"想象",target:"想像",count:1}]
</script>
```

### API

| 方法 | 簽章 | 說明 |
| --- | --- | --- |
| `loadList(url?)` | `(url='./correction-data.json') → Promise<Array>` | 載入資料來源清單。自動加上 cache-busting 確保讀到最新內容。 |
| `loadSource(file, base?)` | `(file, base='./correction-data/') → Promise<Array>` | 載入單一校正字集（`base + file`）。同樣 cache-busting。 |
| `apply(text, rules)` | `→ { text, stats, total }` | 套用校正。詳見下方。 |
| `timestamp(date?)` | `(date=new Date()) → "yyyyMMddHHmmss"` | 產生本地時間戳。 |
| `stampFilename(name, ts?)` | `(name, ts=timestamp()) → string` | 為下載檔名加時間戳：主檔名結尾**已有**時間戳則**替換**，否則在副檔名前**附加**。 |

### `apply(text, rules)`

以**字面字串**（literal，非正規表示式）**逐條依序**全域替換：每條規則 `source` 陣列中的每個字串都會被換成該規則的 `target`。

回傳物件：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `text` | `string` | 校正後的完整文字 |
| `stats` | `Array<{ source, target, count }>` | 每條**有命中**的替換與次數 |
| `total` | `number` | 總替換次數 |

### 從伺服器載入字集後套用

```js
// 1) 載入清單 → 取第一個字集 → 載入它 → 套用
const list  = await CorrectionLib.loadList();              // [{ alias, file, description }, ...]
const rules = await CorrectionLib.loadSource(list[0].file);
const out   = CorrectionLib.apply(原始逐字稿, rules);

// 2) 以原檔名 + 校正時間戳命名下載
const name = CorrectionLib.stampFilename("逐字稿.txt");     // → "逐字稿-20260610153000.txt"
// 逐字稿-20250101000000.txt → 逐字稿-20260610153000.txt（時間戳被替換，而非重複附加）
```

> 引擎本身與 UI 無關，`index.html` 與 `correction-data-builder.html` 都只是它的前端外殼。

---

## License

[MIT](./LICENSE) © 2026 Scott G.F. Hong
