(function () {
  'use strict';

  // Owner_3saka 専用データ設定
  // Ownerはグループ列による絞り込みを行いません。

  const PUBLISHED_SHEET_ID =
    '2PACX-1vS0cL4KlJ-xit2MY_kzKxTa3tqem2wwIgiE8SRo_EvyBUVhpYIEY7xr09iramMAjN0R7AcI7Ds9VBWo';

  const CSV_URL =
    `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub?output=csv`;

  window.TALK_SOURCES = window.TALK_SOURCES || {};

  window.TALK_SOURCES.Owner = {
    csvUrl: CSV_URL,
    filterByGroup: false
  };

})();
