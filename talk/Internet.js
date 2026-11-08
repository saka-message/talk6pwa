(function () {
  'use strict';

  // Internet_nogizaka46
  // Internet_sakurazaka46
  // Internet_hinatazaka46 共通データ設定

  // グループの絞り込みはindex.html側で行います。

  const PUBLISHED_SHEET_ID =
    '2PACX-1vTfLQRvus5Misi0An0YiOZNb9Mb2DFnuoBHseWBSnDJS0j1m-v4dWziIt84j00lw1RomYU9i-MqKuWv';

  const CSV_URL =
    `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub?output=csv`;

  window.TALK_SOURCES = window.TALK_SOURCES || {};

  window.TALK_SOURCES.Internet = {
    csvUrl: CSV_URL,
    filterByGroup: true
  };

})();
