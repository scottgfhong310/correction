/**
 * CorrectionLib — 文件校正引擎（可嵌入式 library）
 *
 * 構想：speech-to-text 逐字稿中因發音而被錯判的字詞，依「校正字集」批次替換成正確字詞。
 *
 * 校正字集（correction-data）為 JSON 陣列，每個條目：
 *   { "source": ["台玉", "泰玉"], "target": "台裕" }
 *   → source 陣列中每個字串都會被替換成 target。
 *
 * 資料來源清單（correction-data.json）為 JSON 陣列，每個條目：
 *   { "alias": ["台裕相關字集"], "file": "ty-releated.json", "description": "..." }
 *
 * 依賴：無（使用原生 fetch）。建議與 jQuery / Materialize / Lodash 一起載入。
 *
 * Public API：
 *   CorrectionLib.loadList(url)            → Promise<Array>  載入資料來源清單
 *   CorrectionLib.loadSource(file, base)   → Promise<Array>  載入單一校正字集
 *   CorrectionLib.apply(text, rules)       → { text, stats, total }  套用校正
 *   CorrectionLib.timestamp(date)          → 'yyyyMMddHHmmss'
 *   CorrectionLib.stampFilename(name, ts)  → 在副檔名前插入 -<ts>
 */
(function (window) {
  'use strict';

  function pad2(n) { return String(n).length >= 2 ? String(n) : ('0' + n).slice(-2); }
  function pad3(n) { return ('00' + n).slice(-3); }

  // 加上 cache-busting query，確保每次都讀到伺服器最新內容（重新載入功能仰賴此）
  function bust(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
  }

  // 主檔名結尾的 yyyyMMddHHmmss 時間戳（前面可有 - 或 _ 分隔符），含合理範圍驗證，
  // 避免誤判一般的 14 位數字（月 01-12、日 01-31、時 00-23、分/秒 00-59）。
  var TS_TAIL = /([-_])?(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])([0-5]\d)([0-5]\d)$/;

  var CorrectionLib = {

    /**
     * 載入資料來源清單（correction-data.json）。
     * 回傳陣列，每項 { alias, file, description }。
     */
    loadList: function (url) {
      url = url || './correction-data.json';
      return fetch(bust(url), { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('載入清單失敗 (' + r.status + ')：' + url);
        return r.json();
      }).then(function (data) {
        if (!Array.isArray(data)) throw new Error('correction-data.json 格式錯誤：應為陣列');
        return data;
      });
    },

    /**
     * 載入單一校正字集。file 為檔名（如 'ty-releated.json'），
     * base 為字集目錄（預設 './correction-data/'）。
     * 回傳陣列，每項 { source: [...], target }。
     */
    loadSource: function (file, base) {
      base = base || './correction-data/';
      if (base.charAt(base.length - 1) !== '/') base += '/';
      var url = base + file;
      return fetch(bust(url), { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('載入字集失敗 (' + r.status + ')：' + url);
        return r.json();
      }).then(function (data) {
        if (!Array.isArray(data)) throw new Error(file + ' 格式錯誤：應為陣列');
        return data;
      });
    },

    /**
     * 套用校正規則。以「字面字串」(literal) 全域替換，逐條依序處理。
     *
     * @param {string} text   原始文字
     * @param {Array}  rules  校正字集 [{ source:[...]|string, target }]
     * @returns {{ text:string, stats:Array, total:number }}
     *          stats: [{ source, target, count }]（僅列出有命中的替換）
     */
    apply: function (text, rules) {
      var out = String(text == null ? '' : text);
      var stats = [];
      var total = 0;
      if (!Array.isArray(rules)) return { text: out, stats: stats, total: 0 };

      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i] || {};
        var target = (rule.target == null) ? '' : String(rule.target);
        var sources = rule.source;
        if (typeof sources === 'string') sources = [sources];
        if (!Array.isArray(sources)) continue;

        for (var j = 0; j < sources.length; j++) {
          var src = sources[j];
          if (src == null) continue;
          src = String(src);
          if (!src || src === target) continue; // 空字串或無變化則略過
          var parts = out.split(src);
          var count = parts.length - 1;
          if (count > 0) {
            out = parts.join(target);
            stats.push({ source: src, target: target, count: count });
            total += count;
          }
        }
      }
      return { text: out, stats: stats, total: total };
    },

    /** 產生本地時間 yyyyMMddHHmmss */
    timestamp: function (date) {
      var d = date || new Date();
      return d.getFullYear() +
        pad2(d.getMonth() + 1) +
        pad2(d.getDate()) +
        pad2(d.getHours()) +
        pad2(d.getMinutes()) +
        pad2(d.getSeconds());
    },

    /**
     * 為下載檔名加上校正時間戳 yyyyMMddHHmmss。
     *   - 若主檔名結尾「已經」是時間戳，則直接「換成」新的（保留原分隔符號），
     *     例如 a-20260101120000.txt → a-20260608153000.txt
     *   - 否則在副檔名前「附加」 -時間戳，例如 a.txt → a-20260608153000.txt
     */
    stampFilename: function (name, ts) {
      ts = ts || this.timestamp();
      name = name || 'corrected.txt';
      var dot = name.lastIndexOf('.');
      var stem = dot > 0 ? name.slice(0, dot) : name;
      var ext = dot > 0 ? name.slice(dot) : '';
      var m = stem.match(TS_TAIL);
      if (m) {
        // 結尾已是時間戳 → 以新時間戳取代（保留 - 或 _ 分隔符）
        stem = stem.slice(0, m.index) + (m[1] || '') + ts;
      } else {
        // 沒有時間戳 → 附加
        stem = stem + '-' + ts;
      }
      return stem + ext;
    }
  };

  // 內部用 pad3（保留以備擴充）
  CorrectionLib._pad3 = pad3;

  window.CorrectionLib = CorrectionLib;
})(window);
