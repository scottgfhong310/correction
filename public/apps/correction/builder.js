/**
 * correction-data-builder — 頁面控制器（glue）
 *
 * 從 correction-data-builder.html 內嵌 <script> 拉出：載入/編輯/儲存校正字集、
 * 新增資料來源、i18n 動態重繪。核心載入/替換邏輯在 correction-lib.js。
 *
 * 依賴（皆於 HTML <head> 先載入）：jQuery / Materialize / Lodash / CorrectionLib / I18n。
 */

$(function () {
  var BASE = './correction-data/';

  // ---- 主題（light / dark，預設 dark；與 index 共用 localStorage('correction-theme')）----
  var THEME_KEY = 'correction-theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    $('#setting-mode i').text(t === 'dark' ? 'dark_mode' : 'light_mode');
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  applyTheme((function () { try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; } })());
  $('#setting-mode').on('click', function () {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  var state = { sources: [], current: null, statusThunk: null };

  var $select = $('#sourceSelect');
  M.Modal.init(document.getElementById('newSourceModal'));

  // 網址帶入的 ?file= → 開啟後自動選取對應的 correction-data
  var wantFile = new URLSearchParams(location.search).get('file');

  // ---- i18n：初始套用、語系切換器、動態重繪 ----
  I18n.apply(document);
  function buildLangSwitch() {
    var $s = $('#langSwitch').empty();
    I18n.langs.forEach(function (code) {
      $s.append('<li><a href="#!" class="lang-link" data-lang="' + code + '">' + _.escape(I18n.name(code)) + '</a></li>');
    });
  }
  function paintLang() {
    $('#langSwitch a').removeClass('active');
    $('#langSwitch a[data-lang="' + I18n.lang + '"]').addClass('active');
  }
  buildLangSwitch();
  paintLang();
  $('#langSwitch').on('click', 'a', function (e) {
    e.preventDefault();
    I18n.set($(this).data('lang'));
  });
  // 儲存列狀態以 thunk 記住，切換語系時可重繪
  function setStatus(thunk) {
    state.statusThunk = thunk;
    $('#saveStatus').text(thunk ? thunk() : '');
  }
  document.addEventListener('i18n:changed', function () {
    paintLang();
    renderSelectOptions(state.current ? state.current.idx : null);
    if (state.statusThunk) $('#saveStatus').text(state.statusThunk());
    // 已存在的條目列由 set() 內的 I18n.apply(document) 重套 placeholder / title
  });

  // ---- 下拉選項（loadList 與語系切換共用）----
  function renderSelectOptions(selectIdx) {
    $select.empty().append('<option value="" disabled' + (selectIdx == null ? ' selected' : '') + '>' + I18n.t('opt.selectSource') + '</option>');
    state.sources.forEach(function (item, idx) {
      var label = (Array.isArray(item.alias) ? item.alias.join(' / ') : item.alias) || item.file;
      var opt = $('<option>').val(idx).text(label + I18n.t('meta.fileParen', { file: item.file }));
      if (selectIdx === idx) opt.prop('selected', true);
      $select.append(opt);
    });
    $select.formSelect();
  }

  // ---- 載入清單 ----
  function loadList(selectIdx) {
    return CorrectionLib.loadList('./correction-data.json').then(function (list) {
      state.sources = list;
      // 未指定索引但網址帶 ?file= 時，依檔名找出要預選的項目
      if (selectIdx == null && wantFile) {
        var wi = list.findIndex(function (it) { return it.file === wantFile; });
        if (wi >= 0) selectIdx = wi;
      }
      renderSelectOptions(selectIdx);
      if (selectIdx != null) $select.trigger('change');
    }).catch(function (err) {
      M.toast({ html: I18n.t('toast.listLoadFailed', { msg: err.message }), classes: 'red' });
    });
  }
  loadList();

  // ---- 選擇來源 → 載入條目 ----
  $select.on('change', function () {
    var idx = parseInt($select.val(), 10);
    var item = state.sources[idx];
    if (!item) return;
    state.current = { idx: idx, item: item };
    $('#fileMeta').text(item.file);
    loadEntries(item);
  });

  function loadEntries(item) {
    CorrectionLib.loadSource(item.file, BASE).then(function (rules) {
      renderEntries(rules);
      $('#editorCard, #saveBar').show();
      var n = rules.length, file = item.file;
      setStatus(function () { return I18n.t('b.status.loaded', { n: n, file: file }); });
    }).catch(function (err) {
      M.toast({ html: I18n.t('toast.sourceLoadFailed', { msg: err.message }), classes: 'red' });
    });
  }

  function rowHtml() {
    return '<tr>' +
      '<td class="col-src"><textarea class="src" data-i18n-placeholder="b.ph.src" placeholder="一行一個原字詞"></textarea></td>' +
      '<td class="col-tgt"><input class="tgt" type="text" data-i18n-placeholder="b.ph.tgt" placeholder="校正後字詞"></td>' +
      '<td class="col-act"><a href="#!" class="del-row red-text" data-i18n-title="b.del.title" title="刪除"><i class="material-icons">delete</i></a></td>' +
      '</tr>';
  }
  function newRow() {
    var $row = $(rowHtml());
    I18n.apply($row[0]); // 讓新列的 placeholder / title 符合目前語系
    return $row;
  }

  function renderEntries(rules) {
    var $body = $('#entryBody').empty();
    rules.forEach(function (r) {
      var src = Array.isArray(r.source) ? r.source : (r.source != null ? [r.source] : []);
      var $row = newRow();
      $row.find('.src').val(src.join('\n'));
      $row.find('.tgt').val(r.target == null ? '' : r.target);
      $body.append($row);
    });
    if (!rules.length) addRow();
  }

  function addRow() {
    var $row = newRow();
    $('#entryBody').append($row);
    $row.find('.src').focus();
  }

  $('#btnAddRow').on('click', function () { addRow(); });
  $('#entryBody').on('click', '.del-row', function (e) {
    e.preventDefault();
    $(this).closest('tr').remove();
  });

  // ---- 從表格組出資料陣列 ----
  function collectRules() {
    var rules = [];
    $('#entryBody tr').each(function () {
      var src = $(this).find('.src').val()
        .split('\n').map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length; });
      var target = $(this).find('.tgt').val().trim();
      if (!src.length && !target) return; // 整列空 → 略過
      rules.push({ source: src, target: target });
    });
    return rules;
  }

  function validate(rules) {
    for (var i = 0; i < rules.length; i++) {
      if (!rules[i].source.length) return I18n.t('b.err.missingSource', { i: i + 1 });
      if (!rules[i].target) return I18n.t('b.err.missingTarget', { i: i + 1 });
    }
    return null;
  }

  // ---- 儲存 ----
  $('#btnSave').on('click', function () {
    if (!state.current) return;
    var rules = collectRules();
    var err = validate(rules);
    if (err) { M.toast({ html: err, classes: 'red' }); return; }
    var file = state.current.item.file;
    setStatus(function () { return I18n.t('b.status.saving'); });
    $.ajax({
      url: '/api/correction/sources/' + encodeURIComponent(file),
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify(rules)
    }).done(function (resp) {
      var n = rules.length, backed = !!resp.backupPath;
      setStatus(function () { return I18n.t('b.status.saved', { n: n }) + (backed ? ' ' + I18n.t('b.status.backedUp') : ''); });
      M.toast({ html: I18n.t('b.toast.saved', { file: file }), classes: 'green' });
    }).fail(function (xhr) {
      var msg = (xhr.responseJSON && xhr.responseJSON.error) || xhr.statusText || I18n.t('b.status.saveFailed');
      setStatus(function () { return I18n.t('b.status.saveFailed'); });
      M.toast({ html: I18n.t('b.toast.saveFailed', { msg: msg }), classes: 'red' });
    });
  });

  $('#btnReload').on('click', function () {
    if (state.current) loadEntries(state.current.item);
  });

  // ---- 新增資料來源 ----
  $('#btnNewSource').on('click', function () {
    $('#nsFile').val(''); $('#nsAlias').val(''); $('#nsDesc').val('');
    M.Modal.getInstance(document.getElementById('newSourceModal')).open();
  });

  $('#nsCreate').on('click', function () {
    var file = $('#nsFile').val().trim();
    var alias = $('#nsAlias').val().trim();
    var desc = $('#nsDesc').val().trim();
    if (!file) { M.toast({ html: I18n.t('b.err.noFile'), classes: 'red' }); return; }
    if (!/\.json$/i.test(file)) file += '.json';
    if (path_unsafe(file)) { M.toast({ html: I18n.t('b.err.badFile'), classes: 'red' }); return; }
    if (_.some(state.sources, { file: file })) {
      M.toast({ html: I18n.t('b.err.fileExists'), classes: 'orange' }); return;
    }
    // 1) 建立空字集檔
    $.ajax({
      url: '/api/correction/sources/' + encodeURIComponent(file),
      type: 'PUT', contentType: 'application/json', data: JSON.stringify([])
    }).done(function () {
      // 2) 加入清單並寫回
      var newList = state.sources.slice();
      newList.push({ alias: alias || file, file: file, description: desc });
      $.ajax({
        url: '/api/correction/list',
        type: 'PUT', contentType: 'application/json', data: JSON.stringify(newList)
      }).done(function () {
        M.Modal.getInstance(document.getElementById('newSourceModal')).close();
        M.toast({ html: I18n.t('b.toast.created', { file: file }), classes: 'green' });
        loadList(newList.length - 1); // 重新載入並選取新項目
      }).fail(failToast('b.err.writeListFailed'));
    }).fail(failToast('b.err.createFileFailed'));
  });

  function failToast(key) {
    return function (xhr) {
      var msg = (xhr.responseJSON && xhr.responseJSON.error) || xhr.statusText || I18n.t(key);
      M.toast({ html: I18n.t('b.toast.failPattern', { label: I18n.t(key), msg: msg }), classes: 'red' });
    };
  }

  function path_unsafe(name) {
    return name.indexOf('/') >= 0 || name.indexOf('\\') >= 0 || name.indexOf('..') >= 0;
  }
});
