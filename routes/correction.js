/**
 * correction
 * ----------
 * Correction WebApp 的存檔 handler。把編輯後的校正資料（JSON）寫回 public/ 底下，
 * 給 correction-data-builder.html 使用。
 *
 * 寫入目標只限兩處：
 *   1. 資料來源清單：public/correction-data.json
 *      → PUT /api/correction/list
 *   2. 單一校正字集：public/correction-data/<file>.json
 *      → PUT /api/correction/sources/:file
 *
 * 另提供：
 *   GET /api/correction/sources  → 列出 correction-data/ 下所有 .json 檔
 *
 * 安全限制：
 *   - 只接受 .json 副檔名
 *   - 檔名必須是單純 basename（不可含路徑分隔字元 / .. / null byte）
 *   - 解析後的絕對路徑必須落在 correction-data 目錄下（雙重保險）
 *   - body 必須能解析成 JSON 陣列
 *
 * 行為：
 *   - 若目標檔已存在，先把原檔複製為 <dir>/.bak/<filename>-YYYYMMDDHHMMSS.bak
 *   - 以 2 空格縮排的 UTF-8 JSON 寫入
 *   - 回傳 JSON: { ok: true, path, bytes, backupPath }
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// public 根目錄與校正字集目錄
const APP_DIR = path.join(__dirname, '..', 'public');
const DATA_DIR = path.join(APP_DIR, 'correction-data');
const LIST_FILE = path.join(APP_DIR, 'correction-data.json');

function pad2(n) { return String(n).padStart(2, '0'); }

// 產生 YYYYMMDDHHMMSS 時間戳（本地時間，秒精度）
function timestamp(date = new Date()) {
  return date.getFullYear()
    + pad2(date.getMonth() + 1)
    + pad2(date.getDate())
    + pad2(date.getHours())
    + pad2(date.getMinutes())
    + pad2(date.getSeconds());
}

// 驗證單純檔名 + .json 副檔名，回傳安全的 basename 或 null
function sanitizeJsonName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed.includes('\0')) return null;
  if (path.basename(trimmed) !== trimmed) return null; // 擋掉路徑分隔字元與 ..
  if (!/\.json$/i.test(trimmed)) return null;
  return trimmed;
}

// 把 body 解析成 JSON 陣列；回傳 { data } 或 { error }
function parseArrayBody(body) {
  let data = body;
  if (typeof body === 'string') {
    if (!body.trim()) return { error: 'Empty body' };
    try { data = JSON.parse(body); }
    catch (e) { return { error: 'Body is not valid JSON: ' + e.message }; }
  }
  if (!Array.isArray(data)) return { error: 'Body must be a JSON array' };
  return { data };
}

// 寫前備份（若原檔存在）到 <dir>/.bak/<filename>-<ts>.bak，回傳備份相對路徑或 null
async function backupIfExists(abs, urlDir) {
  try {
    const orig = await fs.readFile(abs);
    const fileName = path.basename(abs);
    const bakDir = path.join(path.dirname(abs), '.bak');
    const bakName = fileName + '-' + timestamp() + '.bak';
    await fs.mkdir(bakDir, { recursive: true });
    await fs.writeFile(path.join(bakDir, bakName), orig);
    return path.posix.join(urlDir, '.bak', bakName);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    return null; // 沒原檔就略過備份
  }
}

// 共用寫檔流程
async function writeJsonFile(abs, urlPath, urlDir, body, res) {
  const parsed = parseArrayBody(body);
  if (parsed.error) {
    return res.status(400).json({ ok: false, error: parsed.error });
  }
  try {
    const backupPath = await backupIfExists(abs, urlDir);
    const text = JSON.stringify(parsed.data, null, 2) + '\n';
    await fs.writeFile(abs, text, 'utf-8');
    const bytes = Buffer.byteLength(text, 'utf8');
    console.log('[correction] PUT', urlPath, '→', bytes, 'bytes',
      backupPath ? '(backup: ' + path.basename(backupPath) + ')' : '(no prior file)');
    return res.json({ ok: true, path: urlPath, bytes, backupPath });
  } catch (err) {
    console.error('[correction] PUT', urlPath, 'failed:', err);
    return res.status(500).json({ ok: false, error: 'Write failed: ' + err.message });
  }
}

// GET /api/correction/sources — 列出 correction-data/ 下的 .json 檔
router.get('/sources', async (req, res) => {
  try {
    const entries = await fs.readdir(DATA_DIR);
    const files = entries.filter(n => /\.json$/i.test(n)).sort();
    return res.json({ ok: true, files });
  } catch (err) {
    if (err.code === 'ENOENT') return res.json({ ok: true, files: [] });
    console.error('[correction] GET /sources failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/correction/list — 寫回資料來源清單 correction-data.json
router.put('/list', express.json({ limit: '5mb' }), (req, res) => {
  return writeJsonFile(LIST_FILE, '/api/correction/list', '/correction-data', req.body, res);
});

// PUT /api/correction/sources/:file — 寫回單一校正字集
router.put('/sources/:file', express.json({ limit: '5mb' }), async (req, res) => {
  const safe = sanitizeJsonName(req.params.file);
  if (!safe) {
    return res.status(400).json({ ok: false, error: 'Invalid filename (must be a plain *.json name)' });
  }
  const abs = path.join(DATA_DIR, safe);
  if (abs !== DATA_DIR && !abs.startsWith(DATA_DIR + path.sep)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: resolved path outside data dir' });
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  return writeJsonFile(abs, '/api/correction/sources/' + safe, '/correction-data', req.body, res);
});

module.exports = router;
