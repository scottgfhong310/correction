# Correction

[中文](README.md) · [English](README.en.md) · **日本語**

プレーンテキストファイル（`.txt`、`.md`、`.json`、`.srt` など）の内容を校正する WebApp です。

着想は音声認識（speech-to-text）の文字起こしから：**発音のせいで誤変換された語**を、「校正セット」に従って正しい語へ一括置換します。

- バックエンド：Node.js + Express（最小限。静的ファイル・アップロード・セット保存のみ）
- フロントエンド：jQuery + Materialize CSS + Lodash（すべて CDN から読み込み）

![Correction ホーム — 文字起こしをアップロードし、校正セットを選び、ワンクリックで校正。右側に結果と各置換の回数を表示](docs/screenshot.png)

---

## 機能

2 つのページ：

| ページ | 用途 |
| --- | --- |
| `index.html`（ホーム） | 校正対象ファイルのアップロード、校正セットの選択、校正の実行、結果のコピー／ダウンロード |
| `correction-data-builder.html` | 校正セットの編集／追加 |

### `index.html` — 校正の流れ
1. `correction-data.json`（校正データの一覧）を読み込みます。
2. **ドラッグ**または**選択**でファイルを `public/upload/correction/` にアップロードします。
3. 左カラムにアップロードした内容が表示されます（テキストを直接貼り付けてもOK）。
4. 校正データ（correction-data）を選びます。
5. **校正を実行** を押します。
6. 右カラムに校正結果と、各置換の回数が表示されます。
7. **コピー**、または元のファイル名＋校正タイムスタンプ（`yyyyMMddHHmmss`）で**ダウンロード**できます。
   - 元のファイル名の末尾がすでにタイムスタンプの場合、ダウンロード時に**置換**され、二重に付加されません。
8. builder でセットを編集したあとは、**再読み込み** で最新内容をすぐ反映できます。

### `correction-data-builder.html` — セットの編集
1. 一覧の読み込み後、編集する校正データを選びます。
2. 項目の編集／追加／削除、または**データを追加**（新規ファイルを作成し一覧に登録）。
3. **保存** でサーバーに書き戻します。上書き前に `.bak/` へタイムスタンプ付きのバックアップを残します。

---

## 校正セットの形式

校正セットは `.json` 配列で、各項目の `source` 配列の**すべての文字列**が `target` に置換されます：

```json
[
  { "source": ["佈署", "布署"], "target": "部署" },
  { "source": ["想象"],         "target": "想像" }
]
```

`correction-data.json` はデータ一覧です：

```json
[
  {
    "alias": "示範字集",
    "file": "sample.json",
    "description": "示範用：常見的同音／形近錯字校正字集"
  }
]
```

> `public/correction-data/sample.json` はサンプルデータです。自分のセットに置き換えてください。

---

## UI 言語（i18n）

UI は **繁體中文 / English / 日本語** に対応し、右上から即時に切り替えできます。選択はブラウザ（`localStorage`）に記憶されます。URL パラメータで言語を強制することもできます（例：`?lang=ja`、`?lang=en`、`?lang=zh-Hant`）。

辞書はエンジンと分離され、すべて純フロントエンド（依存なし・ビルド不要）：

- `public/i18n.js` — i18n エンジン（`t` / `apply` / `set` / `register`）。
- `public/locales/<code>.js` — 言語ごとの辞書。読み込み時に自己登録します（例：`I18n.register('ja', { … }, '日本語')`）。
- 言語切替は**登録済みの言語から自動生成**されます。
- 日本語 UI では **Noto Sans JP** を読み込み（フォントは `lang=ja` のときのみダウンロード）、日本語漢字の字形をプラットフォーム間で一致させます。

**言語を追加する**には、`public/locales/` に `xx.js` を 1 つ置き、ページで読み込むだけ — エンジン・切替・ページのコードは変更不要です。

> 校正セット自体は**データ内容**であり、翻訳されません。`index.html` と `correction-data-builder.html` の両ページが 3 言語対応済みです。

---

## インストールと起動

Node.js >= 16 が必要です。

```bash
npm install
npm start
```

既定で <http://localhost:3000> で起動します（環境変数で変更可能、例：`PORT=8080 npm start`）。

ブラウザで <http://localhost:3000/> を開くとホームページです。

---

## プロジェクト構成

```
correction/
├─ app.js                 # Express エントリ：静的ファイル + アップロード + セット保存
├─ routes/
│  ├─ upload.js           # POST /api/upload?folder=correction
│  └─ correction.js       # GET/PUT /api/correction/...（セット保存、.bak バックアップ付き）
└─ public/                # フロントエンド（静的）
   ├─ index.html
   ├─ correction-data-builder.html
   ├─ correction-lib.js   # 校正エンジン（リテラル置換 + 統計 + ファイル名タイムスタンプ）
   ├─ correction-data.json
   ├─ correction-data/
   │  └─ sample.json
   └─ upload/correction/  # アップロード一時領域（内容はバージョン管理対象外）
```

---

## API

| メソッド | パス | 説明 |
| --- | --- | --- |
| `POST` | `/api/upload?folder=correction` | ファイルを `public/upload/correction/` にアップロード（multipart フィールド名 `myFiles`） |
| `GET`  | `/api/correction/sources` | `correction-data/` 配下の `.json` セットを一覧 |
| `PUT`  | `/api/correction/sources/:file` | 単一の校正セットを書き戻し（body は JSON 配列） |
| `PUT`  | `/api/correction/list` | データ一覧 `correction-data.json` を書き戻し |

書き込みは `public/correction-data/` 配下の `.json` に限定し、パストラバーサル対策を行います。上書き前に同階層の `.bak/` へバックアップします。

---

## 校正エンジン：`CorrectionLib`

`public/correction-lib.js` はこのプロジェクトの中核 — **依存ゼロ**（ネイティブ `fetch` のみ）の純フロントエンド校正エンジンです。読み込むとグローバルの `window.CorrectionLib` に載り、単体で取り出して「セット置換」が必要な任意のページに適用できます。

```html
<script src="correction-lib.js"></script>
<script>
  // ルールを直接適用（サーバー不要）
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

| メソッド | シグネチャ | 説明 |
| --- | --- | --- |
| `loadList(url?)` | `(url='./correction-data.json') → Promise<Array>` | データ一覧を読み込み。常に最新を読むよう cache-busting を付与。 |
| `loadSource(file, base?)` | `(file, base='./correction-data/') → Promise<Array>` | 単一セット（`base + file`）を読み込み。同じく cache-busting。 |
| `apply(text, rules)` | `→ { text, stats, total }` | 校正を適用。下記参照。 |
| `timestamp(date?)` | `(date=new Date()) → "yyyyMMddHHmmss"` | ローカルのタイムスタンプを生成。 |
| `stampFilename(name, ts?)` | `(name, ts=timestamp()) → string` | ダウンロード名にタイムスタンプを付与：基本名の末尾にすでにあれば**置換**、なければ拡張子の前に**付加**。 |

### `apply(text, rules)`

**リテラル文字列**（正規表現ではない）で**ルール順に**グローバル置換します：各ルールの `source` 配列のすべての文字列が、そのルールの `target` に置換されます。

戻り値：

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `text` | `string` | 校正後の全文 |
| `stats` | `Array<{ source, target, count }>` | **ヒットした**各置換とその回数 |
| `total` | `number` | 置換の合計回数 |

### サーバーからセットを読み込んで適用

```js
// 1) 一覧を読み込み → 最初のセットを取得 → 読み込み → 適用
const list  = await CorrectionLib.loadList();              // [{ alias, file, description }, ...]
const rules = await CorrectionLib.loadSource(list[0].file);
const out   = CorrectionLib.apply(transcript, rules);

// 2) 元の名前 + 校正タイムスタンプでダウンロード名を作成
const name = CorrectionLib.stampFilename("transcript.txt");  // → "transcript-20260610153000.txt"
// transcript-20250101000000.txt → transcript-20260610153000.txt（タイムスタンプは置換、二重付加しない）
```

> エンジンは UI 非依存で、`index.html` と `correction-data-builder.html` はその上のフロントエンドにすぎません。

---

## ライセンス

[MIT](./LICENSE) © 2026 Scott G.F. Hong
