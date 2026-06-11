/**
 * correction — 頁面控制器（glue）
 *
 * 從 index.html 內嵌 <script> 拉出：DOM 繫結、i18n 動態重繪、
 * 上傳 / 校正 / 複製 / 下載流程。核心替換邏輯在 correction-lib.js。
 *
 * 依賴（皆於 index.html <head> 先載入）：jQuery / Materialize / Lodash / CorrectionLib / I18n。
 */

let main = {
  event: {
    binding: function () {
      $(".side-tool").click(function (e) {
        e.preventDefault();
        main.event.setIconDone($(this));
      });

      $("#setting-copy").click(function (e) {
        e.preventDefault();
        $('#btnCopy').click();
      });

      $("#setting-file_download").click(function (e) {
        e.preventDefault();
        $('#btnDownload').click();
      });

      return;
    },
    setIconDone: function (element) {
      let f_icon = element.find('i').text();
      element.find('i').text("check");
      setTimeout(() => {
        element.find('i').text(f_icon);
      }, 800);
    },
  },
  init: function () {
    // Placeholder; will be replaced by module
    console.info(">>> Main init called");
    main.event.binding();
    return;
  }
};

$(function () {
  var BASE = './correction-data/';
  var state = {
    filename: 'corrected.txt',   // 用於下載命名
    rules: null,                 // 已載入的校正字集
    sources: [],                 // 清單
    curDesc: '',                 // 目前字集的說明（內容，不翻譯）
    lastFile: null,              // 已載入檔名（用於重繪 origInfo）
    lastTotal: null,             // 上次校正替換總數
    lastStats: null,             // 上次校正統計
    placeholderKey: 'opt.selectSource' // 下拉預設項目前的 i18n key
  };

  var $select = $('#sourceSelect');
  var $run = $('#btnRun');
  var $copy = $('#btnCopy');
  var $download = $('#btnDownload');

  // ---- i18n：初始套用、語系切換器、動態字串重繪 ----
  I18n.apply(document);
  // 依已註冊的語言自動產生切換器（新增語言＝多一個 locale 檔，這裡不用改）
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
  // 切換語系時，重繪由 JS 產生的動態字串（靜態字串已由 I18n.apply 處理）
  function renderDynamic() {
    // 下拉預設項
    var $first = $('#sourceSelect option').first();
    if ($first.is('[disabled]')) {
      $first.text(I18n.t(state.placeholderKey));
      $select.formSelect();
    }
    if (state.rules) $('#sourceMeta').text(I18n.t('meta.rulesLoaded', { n: state.rules.length }) + state.curDesc);
    if (state.lastFile) $('#origInfo').text(I18n.t('meta.fileParen', { file: state.lastFile }));
    if (state.lastTotal != null) {
      $('#resultInfo').text(I18n.t('meta.replacedN', { n: state.lastTotal }));
      renderStats(state.lastStats || []);
    }
  }
  document.addEventListener('i18n:changed', function () { paintLang(); renderDynamic(); });

  // ---- 載入資料來源清單 ----
  CorrectionLib.loadList('./correction-data.json').then(function (list) {
    state.sources = list;
    state.placeholderKey = 'opt.selectSource';
    $select.empty();
    $select.append('<option value="" disabled selected>' + I18n.t('opt.selectSource') + '</option>');
    list.forEach(function (item, idx) {
      var label = (Array.isArray(item.alias) ? item.alias.join(' / ') : item.alias) || item.file;
      $select.append($('<option>').val(idx).text(label));
    });
    $select.formSelect();
  }).catch(function (err) {
    state.placeholderKey = 'opt.listLoadFailed';
    $select.empty().append('<option value="" disabled selected>' + I18n.t('opt.listLoadFailed') + '</option>').formSelect();
    M.toast({ html: I18n.t('toast.listLoadFailed', { msg: err.message }), classes: 'red' });
  });

  // 載入目前選擇的字集 rules（change 與「重新載入」共用）
  function loadCurrentSource(showToast) {
    var idx = parseInt($select.val(), 10);
    var item = state.sources[idx];
    if (!item) return;
    // 讓「編輯校正字集」連結帶上目前選擇的 correction-data
    $('#builderLink').attr('href', './correction-data-builder.html?file=' + encodeURIComponent(item.file));
    $('#sourceMeta').text(I18n.t('meta.loading'));
    return CorrectionLib.loadSource(item.file, BASE).then(function (rules) {
      state.rules = rules;
      state.curDesc = item.description ? ' — ' + item.description : '';
      $('#sourceMeta').text(I18n.t('meta.rulesLoaded', { n: rules.length }) + state.curDesc);
      maybeEnableRun();
      if (showToast) {
        M.toast({ html: I18n.t('toast.reloaded', { file: item.file, n: rules.length }), classes: 'teal' });
      }
    }).catch(function (err) {
      state.rules = null;
      $('#sourceMeta').text('');
      M.toast({ html: I18n.t('toast.sourceLoadFailed', { msg: err.message }), classes: 'red' });
    });
  }

  // 選擇字集 → 載入 rules，並啟用「重新載入」
  $select.on('change', function () {
    $('#btnReload').toggleClass('disabled', !state.sources[parseInt($select.val(), 10)]);
    loadCurrentSource(false);
  });

  // 重新載入目前使用中的 correction-data（在 builder 改完後可即時更新）
  $('#btnReload').on('click', function () {
    if ($(this).hasClass('disabled')) return;
    loadCurrentSource(true);
  });

  // ---- 上傳 / 讀取檔案 ----
  var $drop = $('#dropZone');
  var $picker = $('#filePicker');

  $drop.on('dragenter dragover', function (e) {
    e.preventDefault(); e.stopPropagation(); $drop.addClass('dragover');
  });
  $drop.on('dragleave dragend drop', function (e) {
    e.preventDefault(); e.stopPropagation(); $drop.removeClass('dragover');
  });
  $drop.on('drop', function (e) {
    var files = e.originalEvent.dataTransfer.files;
    if (files && files.length) handleFile(files[0]);
  });
  $drop.on('click', function () { $picker.click(); });
  $picker.on('change', function (e) {
    if (e.target.files && e.target.files.length) handleFile(e.target.files[0]);
    $picker.val('');
  });

  function handleFile(file) {
    state.filename = file.name || 'corrected.txt';
    state.lastFile = file.name;
    $('#origInfo').text(I18n.t('meta.fileParen', { file: file.name }));
    // 1) 即時讀取內容顯示
    var reader = new FileReader();
    reader.onload = function () {
      $('#original').val(reader.result);
      M.textareaAutoResize($('#original'));
      maybeEnableRun();
    };
    reader.onerror = function () {
      M.toast({ html: I18n.t('toast.readFailed'), classes: 'red' });
    };
    reader.readAsText(file, 'UTF-8');

    // 2) 上傳到 /upload/correction 資料夾
    var fd = new FormData();
    fd.append('myFiles', file);
    $.ajax({
      url: '/api/upload?folder=correction',
      type: 'POST', data: fd, processData: false, contentType: false
    }).done(function (resp) {
      if (resp && resp.success) {
        M.toast({ html: I18n.t('toast.uploaded', { file: file.name }), classes: 'green' });
      } else {
        M.toast({ html: I18n.t('toast.uploadFailed', { msg: (resp && resp.error) || I18n.t('error.unknown') }), classes: 'orange' });
      }
    }).fail(function (xhr) {
      var msg = (xhr.responseJSON && xhr.responseJSON.error) || xhr.statusText || I18n.t('error.unknown');
      M.toast({ html: I18n.t('toast.uploadFailed', { msg: msg }), classes: 'orange' });
    });
  }

  function maybeEnableRun() {
    var ready = !!state.rules && $('#original').val().length > 0;
    $run.toggleClass('disabled', !ready);
  }
  $('#original').on('input', maybeEnableRun);

  // ---- 執行校正 ----
  $run.on('click', function () {
    if ($run.hasClass('disabled')) return;
    var text = $('#original').val();
    var res = CorrectionLib.apply(text, state.rules || []);
    state.lastTotal = res.total;
    state.lastStats = res.stats;
    $('#result').val(res.text);
    M.textareaAutoResize($('#result'));
    $('#resultInfo').text(I18n.t('meta.replacedN', { n: res.total }));
    renderStats(res.stats);
    $copy.toggleClass('disabled', !res.text.length);
    $download.toggleClass('disabled', !res.text.length);
    M.toast({ html: I18n.t('toast.corrected', { n: res.total }), classes: res.total ? 'teal' : 'grey' });
  });

  function renderStats(stats) {
    var $s = $('#stats');
    if (!stats.length) { $s.html('<p class="meta">' + I18n.t('stats.none') + '</p>'); return; }
    var rows = stats.map(function (s) {
      return '<tr><td>' + _.escape(s.source) + '</td><td>→</td><td>' +
        _.escape(s.target) + '</td><td class="right-align">' + s.count + '</td></tr>';
    }).join('');
    $s.html(
      '<table class="striped"><thead><tr><th>' + I18n.t('stats.source') + '</th><th></th><th>' +
      I18n.t('stats.target') + '</th><th class="right-align">' + I18n.t('stats.count') + '</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>'
    );
  }

  // ---- 複製內容 ----
  $copy.on('click', function () {
    if ($copy.hasClass('disabled')) return;
    var text = $('#result').val();
    var done = function () { M.toast({ html: I18n.t('toast.copied'), classes: 'green' }); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
    } else { fallbackCopy(); }
    function fallbackCopy() {
      var $t = $('#result');
      $t.prop('readonly', false).focus().select();
      try { document.execCommand('copy'); done(); }
      catch (e) { M.toast({ html: I18n.t('toast.copyFailed'), classes: 'red' }); }
      $t.prop('readonly', true);
    }
  });

  // ---- 下載（原檔名 + 校正日期 yyyyMMddHHmmss）----
  $download.on('click', function () {
    if ($download.hasClass('disabled')) return;
    var text = $('#result').val();
    var name = CorrectionLib.stampFilename(state.filename, CorrectionLib.timestamp());
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    M.toast({ html: I18n.t('toast.downloaded', { name: name }), classes: 'teal' });
  });
});

$(document).ready(function () {
  console.info(">>> jQuery loaded, version:", $.fn.jquery);
  main.init();
});
