/**
 * Correction — 協助校正文件內容的 WebApp
 *
 * 構想源自 speech-to-text 產生的逐字稿：把因發音而被錯判的字詞，
 * 依「校正字集」批次替換成正確字詞。
 *
 * 純前端（jQuery + Materialize + Lodash，皆走 CDN）＋ 極簡 Express 後端：
 *   - 靜態檔：public/
 *   - POST /api/upload?folder=correction  上傳待校正檔案到 public/upload/correction/
 *   - PUT  /api/correction/...            儲存校正字集（builder 用）
 */

const path = require('path');
const express = require('express');
const logger = require('morgan');

const uploadRouter = require('./routes/upload');
const correctionRouter = require('./routes/correction');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(logger('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/upload', uploadRouter);
app.use('/api/correction', correctionRouter);

// 根路徑導向應用頁
app.get('/', (req, res) => res.redirect('/apps/correction/'));

// 404（API 回 JSON，其餘回簡短訊息）
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  res.status(404).type('text/plain').send('Not found');
});

app.listen(PORT, () => {
  console.log(`Correction →  http://localhost:${PORT}/apps/correction/`);
});

module.exports = app;
