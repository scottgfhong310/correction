/**
 * I18n — 極簡前端多語系工具（無相依套件）
 *
 * 用法：
 *   靜態文字：<span data-i18n="btn.run">執行校正</span>
 *   innerHTML（含 icon 等）：<div data-i18n-html="drop.hint">…</div>
 *   屬性：data-i18n-placeholder / data-i18n-title / （<body> 上）data-i18n-doctitle
 *   程式內：I18n.t('meta.rulesLoaded', { n: 5 })
 *   切換：I18n.set('en')  // 會 persist 並派發 document 事件 'i18n:changed'
 *
 * 初始語系決定順序：?lang= 網址參數 → localStorage('lang') → 瀏覽器語言 → 'zh-Hant'
 */
(function (window) {
  'use strict';

  var DEFAULT = 'zh-Hant';

  var dict = {
    'zh-Hant': {
      'title.page': 'Correction — 文件校正',
      'nav.builder': '編輯校正字集',
      'toolbar.sourceLabel': '校正資料來源（correction-data）',
      'btn.run': '執行校正',
      'btn.reload': '重新載入',
      'btn.reloadTitle': '重新載入目前使用的校正資料來源',
      'card.original': '原始內容',
      'card.result': '校正結果',
      'drop.hint': '<i class="material-icons">cloud_upload</i>拖拉檔案到這裡，或<u>點擊選擇檔案</u>上傳至 /upload/correction',
      'ph.original': '上傳檔案後內容會顯示在這裡，也可以直接貼上文字…',
      'ph.result': '按「執行校正」後，結果會顯示在這裡…',
      'btn.copy': '複製內容',
      'btn.download': '下載',
      'opt.loading': '載入中…',
      'opt.selectSource': '請選擇校正資料來源…',
      'opt.listLoadFailed': '清單載入失敗',
      'meta.loading': '載入中…',
      'meta.rulesLoaded': '共 {n} 條規則',
      'meta.fileParen': '（{file}）',
      'meta.replacedN': '（替換 {n} 處）',
      'stats.none': '沒有任何替換。',
      'stats.source': '原字詞',
      'stats.target': '校正為',
      'stats.count': '次數',
      'error.unknown': '未知錯誤',
      'toast.listLoadFailed': '清單載入失敗：{msg}',
      'toast.reloaded': '已重新載入：{file}（{n} 條規則）',
      'toast.sourceLoadFailed': '字集載入失敗：{msg}',
      'toast.readFailed': '讀取檔案失敗',
      'toast.uploaded': '已上傳至 /upload/correction：{file}',
      'toast.uploadFailed': '上傳失敗：{msg}',
      'toast.corrected': '校正完成，共替換 {n} 處',
      'toast.copied': '已複製到剪貼簿',
      'toast.copyFailed': '複製失敗，請手動選取',
      'toast.downloaded': '已下載：{name}'
    },
    'en': {
      'title.page': 'Correction — Document Correction',
      'nav.builder': 'Edit correction sets',
      'toolbar.sourceLabel': 'Correction source (correction-data)',
      'btn.run': 'Run correction',
      'btn.reload': 'Reload',
      'btn.reloadTitle': 'Reload the correction set currently in use',
      'card.original': 'Original',
      'card.result': 'Result',
      'drop.hint': '<i class="material-icons">cloud_upload</i>Drag a file here, or <u>click to choose a file</u> — uploaded to /upload/correction',
      'ph.original': 'Uploaded content shows here — or just paste text…',
      'ph.result': 'Click “Run correction” and the result shows here…',
      'btn.copy': 'Copy',
      'btn.download': 'Download',
      'opt.loading': 'Loading…',
      'opt.selectSource': 'Select a correction set…',
      'opt.listLoadFailed': 'Failed to load list',
      'meta.loading': 'Loading…',
      'meta.rulesLoaded': '{n} rule(s)',
      'meta.fileParen': '({file})',
      'meta.replacedN': '({n} replaced)',
      'stats.none': 'No replacements.',
      'stats.source': 'Original',
      'stats.target': 'Corrected to',
      'stats.count': 'Count',
      'error.unknown': 'Unknown error',
      'toast.listLoadFailed': 'Failed to load list: {msg}',
      'toast.reloaded': 'Reloaded {file} ({n} rule(s))',
      'toast.sourceLoadFailed': 'Failed to load set: {msg}',
      'toast.readFailed': 'Failed to read file',
      'toast.uploaded': 'Uploaded to /upload/correction: {file}',
      'toast.uploadFailed': 'Upload failed: {msg}',
      'toast.corrected': 'Done — {n} replacement(s)',
      'toast.copied': 'Copied to clipboard',
      'toast.copyFailed': 'Copy failed — please select manually',
      'toast.downloaded': 'Downloaded: {name}'
    }
  };

  function readSaved() {
    try { return localStorage.getItem('lang'); } catch (e) { return null; }
  }
  function writeSaved(l) {
    try { localStorage.setItem('lang', l); } catch (e) { /* ignore */ }
  }

  function resolveInitial() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { /* ignore */ }
    if (q && dict[q]) return q;
    var saved = readSaved();
    if (saved && dict[saved]) return saved;
    var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (nav.indexOf('zh') === 0) return 'zh-Hant';
    return dict.en ? 'en' : DEFAULT;
  }

  var lang = resolveInitial();

  function t(key, params) {
    var table = dict[lang] || {};
    var s = (key in table) ? table[key]
          : (dict.en && key in dict.en) ? dict.en[key]
          : key;
    if (params) {
      Object.keys(params).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
      });
    }
    return s;
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    var dt = document.querySelector('[data-i18n-doctitle]');
    if (dt) document.title = t(dt.getAttribute('data-i18n-doctitle'));
    document.documentElement.lang = (lang === 'zh-Hant') ? 'zh-Hant' : lang;
    // Materialize：重新定位浮動 label
    if (window.M && M.updateTextFields) { try { M.updateTextFields(); } catch (e) {} }
  }

  function set(l) {
    if (!dict[l] || l === lang) { if (dict[l]) { writeSaved(l); } return; }
    lang = l;
    writeSaved(l);
    apply(document);
    document.dispatchEvent(new Event('i18n:changed'));
  }

  window.I18n = {
    t: t,
    apply: apply,
    set: set,
    get lang() { return lang; },
    langs: Object.keys(dict),
    dict: dict
  };
})(window);
