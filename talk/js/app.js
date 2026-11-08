
(() => {
  'use strict';

  const app = document.createElement('div');
  app.className = 'app';
  app.innerHTML = `
    <header class="header">
      <a class="header-button back" href="../index.html" aria-label="戻る">‹</a>
      <div class="header-title" id="roomTitle">トーク</div>
      <button class="header-button menu" id="menuButton" type="button" aria-label="メニュー">•••</button>
    </header>
    <main class="main" id="main">
      <div class="loading" id="status">投稿を読み込んでいます…</div>
      <div class="older-loader" id="olderLoader">
        <div class="spinner"></div>
        古い投稿を読み込んでいます…
      </div>
      <div id="posts"></div>
    </main>
    <button class="to-bottom" id="toBottom" type="button" aria-label="最新の投稿へ戻る">↓</button>
    <div class="action-sheet" id="actionSheet" aria-hidden="true">
      <div class="action-sheet-backdrop" data-close-menu></div>
      <div class="action-sheet-panel" role="dialog" aria-modal="true" aria-label="メニュー">
        <button class="action-sheet-close" type="button" data-close-menu aria-label="閉じる">×</button>
        <div class="action-sheet-title" id="actionSheetTitle">メニュー</div>
        <button class="action-sheet-item" id="shareAction" type="button">
          <img src="../icon/share_icon.svg" alt="">
          <span>シェア</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(app);

  const viewer = document.createElement('div');
  viewer.className = 'image-viewer';
  viewer.id = 'imageViewer';
  viewer.innerHTML = `
    <button class="viewer-close" id="viewerClose" type="button" aria-label="閉じる">×</button>
    <img id="viewerImage" src="" alt="拡大画像">
  `;
  document.body.appendChild(viewer);
})();


(() => {
  'use strict';

  /* ========================================
     ルーム設定
  ======================================== */

  const ROOM_CONFIG = {
    Owner_3saka: {
      source: 'Owner',
      title: '🔞ガールズルール🔞'
    },

    Internet_nogizaka46: {
      source: 'Internet',
      title: '乃木坂46',
      group: 'nogizaka46'
    },

    Internet_sakurazaka46: {
      source: 'Internet',
      title: '櫻坂46',
      group: 'sakurazaka46'
    },

    Internet_hinatazaka46: {
      source: 'Internet',
      title: '日向坂46',
      group: 'hinatazaka46'
    }
  };

  // ブラウザが前回のスクロール位置を復元しないようにする
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const params = new URLSearchParams(location.search);
  const roomKey = params.get('room') || '';
  const room = ROOM_CONFIG[roomKey];

  /* ========================================
     HTML要素
  ======================================== */

  const titleEl = document.getElementById('roomTitle');
  const statusEl = document.getElementById('status');
  const postsEl = document.getElementById('posts');
  const mainEl = document.getElementById('main');
  const olderLoader = document.getElementById('olderLoader');
  const toBottom = document.getElementById('toBottom');

  const imageViewer = document.getElementById('imageViewer');
  const viewerImage = document.getElementById('viewerImage');

  /* ========================================
     投稿読み込み設定
  ======================================== */

  const POSTS_PER_LOAD = 20;

  let allPosts = [];
  let nextIndex = 0;
  let loadingOlder = false;
  let allLoaded = false;

  /* ========================================
     ルーム判定
  ======================================== */

  if (!room) {
    titleEl.textContent = 'トーク';

    statusEl.className = 'error';
    statusEl.textContent =
      'ルーム指定が正しくありません。\nトップページから選択してください。';

    return;
  }

  titleEl.textContent = room.title;
  document.title = '坂道Secretメッセージ';

  /* ========================================
     メニュー
  ======================================== */

  /* ========================================
     シェアメニュー / Web Share API
  ======================================== */

  const actionSheet = document.getElementById('actionSheet');
  const actionSheetTitle = document.getElementById('actionSheetTitle');
  const shareAction = document.getElementById('shareAction');
  let pendingShareData = null;

  function openActionSheet(title, shareData) {
    actionSheetTitle.textContent = title;
    pendingShareData = shareData;
    actionSheet.classList.add('show');
    actionSheet.setAttribute('aria-hidden', 'false');
  }

  function closeActionSheet() {
    actionSheet.classList.remove('show');
    actionSheet.setAttribute('aria-hidden', 'true');
    pendingShareData = null;
  }

  actionSheet.querySelectorAll('[data-close-menu]').forEach(button => {
    button.addEventListener('click', closeActionSheet);
  });

  document.getElementById('menuButton').addEventListener('click', () => {
    openActionSheet('トークルームメニュー', {
      title: room.title,
      text: `${room.title} のトークルーム`,
      url: location.href
    });
  });

  shareAction.addEventListener('click', async () => {
    const data = pendingShareData;
    if (!data) return;

    try {
      if (navigator.share) {
        await navigator.share(data);
      } else if (navigator.clipboard && window.isSecureContext) {
        const shareText = [data.title, data.text, data.url].filter(Boolean).join('\\n');
        await navigator.clipboard.writeText(shareText);
        alert('シェアに対応していないため、内容をコピーしました。');
      } else {
        alert('このブラウザではシェア機能を利用できません。');
      }
    } catch (error) {
      if (error && error.name !== 'AbortError') {
        console.error('シェアに失敗しました:', error);
        alert('シェアに失敗しました。');
      }
    } finally {
      closeActionSheet();
    }
  });

  /* ========================================
     データ設定JSの読み込み
  ======================================== */

  function loadSourceScript() {
    return new Promise((resolve, reject) => {

      const script = document.createElement('script');

      script.src = new URL(
        './' + room.source + '.js',
        document.baseURI
      ).href;

      script.onload = resolve;

      script.onerror = () => {
        reject(
          new Error(
            room.source +
            '.js を読み込めません。talkフォルダ内に配置してください。'
          )
        );
      };

      document.head.appendChild(script);
    });
  }

  /* ========================================
     CSV解析
  ======================================== */

  function parseCSV(text) {

    const rows = [];

    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {

      const c = text[i];
      const next = text[i + 1];

      if (quoted) {

        if (c === '"' && next === '"') {
          field += '"';
          i++;

        } else if (c === '"') {
          quoted = false;

        } else {
          field += c;
        }

      } else if (c === '"') {

        quoted = true;

      } else if (c === ',') {

        row.push(field);
        field = '';

      } else if (c === '\n') {

        row.push(field);
        rows.push(row);

        row = [];
        field = '';

      } else if (c !== '\r') {

        field += c;

      }
    }

    row.push(field);

    if (row.some(v => v !== '')) {
      rows.push(row);
    }

    return rows;
  }

  /* ========================================
     列名の正規化
  ======================================== */

  function normalizeHeader(value) {

    return String(value || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .replace(/\s/g, '')
      .toLowerCase();
  }

  /* ========================================
     列番号の取得
  ======================================== */

  function findColumn(headers, candidates) {

    const normalized = headers.map(normalizeHeader);

    for (const candidate of candidates) {

      const index = normalized.indexOf(
        normalizeHeader(candidate)
      );

      if (index !== -1) {
        return index;
      }
    }

    return -1;
  }

  /* ========================================
     画像URLの安全確認
  ======================================== */

  function safeImageUrl(value) {

    const raw = String(value || '').trim();

    if (!raw) return '';

    try {

      const url = new URL(raw);

      return (
        url.protocol === 'http:' ||
        url.protocol === 'https:'
      ) ? url.href : '';

    } catch (_) {

      return '';
    }
  }

  /* ========================================
     日付を数値化
  ======================================== */

  function dateValue(value) {

    const raw = String(value || '').trim();

    const match = raw.match(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/
    );

    if (match) {

      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4] || 0),
        Number(match[5] || 0)
      ).getTime();
    }

    return new Date(raw).getTime();
  }

  /* ========================================
     日付表示
  ======================================== */

  function formatDate(value) {

    const raw = String(value || '').trim();

    if (!raw) return '';

    const match = raw.match(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/
    );

    if (match) {

      return (
        `${Number(match[2])}/${Number(match[3])}` +
        (
          match[4]
            ? ` ${String(match[4]).padStart(2, '0')}:${match[5]}`
            : ''
        )
      );
    }

    const date = new Date(raw);

    if (!Number.isNaN(date.getTime())) {

      return (
        `${date.getMonth() + 1}/${date.getDate()} ` +
        `${String(date.getHours()).padStart(2, '0')}:` +
        `${String(date.getMinutes()).padStart(2, '0')}`
      );
    }

    return raw;
  }

  /* ========================================
     画像拡大表示
  ======================================== */

  function openImage(src) {

    viewerImage.src = src;
    imageViewer.classList.add('show');
  }

  function closeImage() {

    imageViewer.classList.remove('show');
    viewerImage.src = '';
  }

  document
    .getElementById('viewerClose')
    .addEventListener('click', closeImage);

  imageViewer.addEventListener('click', event => {

    if (event.target === imageViewer) {
      closeImage();
    }
  });

  document.addEventListener('keydown', event => {

    if (event.key === 'Escape') {
      closeImage();
    }
  });

  /* ========================================
     投稿HTML作成
  ======================================== */

  function createPost(item) {

    const article = document.createElement('article');
    article.className = 'post';

    /* 投稿者アイコン */

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'avatar-wrap';

    const avatar = document.createElement('img');

    avatar.className = 'avatar';
    avatar.alt = item.from;
    avatar.loading = 'lazy';

    /* 投稿者名に対応するアイコン */
    const avatarUrl = new URL(
      '../user_img/' + encodeURIComponent(item.from) + '.jpg',
      document.baseURI
    ).href;

    /* 個別アイコンがない場合の共通アイコン */
    const unknownAvatarUrl = new URL(
      '../user_img/unknown.jpg',
      document.baseURI
    ).href;

    avatar.src = avatarUrl;

    /* 個別画像が読み込めなければunknown.jpgに切り替える */
    avatar.onerror = () => {
      /* unknown.jpg自体も存在しない場合の無限ループを防止 */
      if (avatar.src !== unknownAvatarUrl) {
        avatar.src = unknownAvatarUrl;
      } else {
        avatar.onerror = null;
        avatar.style.visibility = 'hidden';
      }
    };

    avatarWrap.appendChild(avatar);

    /* 投稿本文 */

    const body = document.createElement('div');
    body.className = 'post-body';

    /* 投稿者名・日付 */

    const meta = document.createElement('div');
    meta.className = 'post-meta';

    const name = document.createElement('span');
    name.className = 'post-name';
    name.textContent = item.from;

    const date = document.createElement('span');
    date.className = 'post-date';
    date.textContent = formatDate(item.date);

    const more = document.createElement('button');

    more.className = 'post-menu';
    more.type = 'button';
    more.textContent = '•••';
    more.setAttribute('aria-label', '投稿メニュー');

    more.addEventListener('click', () => {
      const shareParts = [];
      if (item.from) shareParts.push(item.from);
      if (item.date) shareParts.push(formatDate(item.date));
      if (item.message) shareParts.push(item.message);
      if (item.image) shareParts.push(item.image);

      openActionSheet('メッセージメニュー', {
        title: `${item.from || room.title} のメッセージ`,
        text: shareParts.join('\\n'),
        url: location.href
      });
    });

    meta.append(name, date, more);
    body.appendChild(meta);

    /* 吹き出し */

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    /* 投稿画像 */

    if (item.image) {

      const image = document.createElement('img');

      image.className = 'post-image';
      image.src = item.image;
      image.alt = '投稿画像';
      image.loading = 'lazy';

      image.addEventListener('click', () => {
        openImage(item.image);
      });

      image.onerror = () => {
        image.remove();
      };

      bubble.appendChild(image);
    }

    /* メッセージ */

    if (item.message) {

      const message = document.createElement('div');

      message.className = 'message';
      message.textContent = item.message;

      bubble.appendChild(message);
    }

    /* 画像・本文が両方空の場合 */

    if (!item.image && !item.message) {

      const empty = document.createElement('div');

      empty.className = 'message';
      empty.textContent = '（画像・本文はありません）';

      bubble.appendChild(empty);
    }

    body.appendChild(bubble);

    article.append(avatarWrap, body);

    return article;
  }

  /* ========================================
     投稿を画面に追加
  ======================================== */

  function renderPosts(items, prepend = false) {

    const fragment = document.createDocumentFragment();

    items.forEach(item => {
      fragment.appendChild(createPost(item));
    });

    if (prepend) {
      postsEl.prepend(fragment);
    } else {
      postsEl.appendChild(fragment);
    }
  }

  /* ========================================
     最新投稿ボタンの表示制御
  ======================================== */

  function updateBottomButton() {

    const remaining =
      mainEl.scrollHeight -
      mainEl.clientHeight -
      mainEl.scrollTop;

    toBottom.classList.toggle(
      'show',
      remaining > 200
    );
  }

  /* ========================================
     初回投稿表示
  ======================================== */

  function renderInitialPosts() {

    const start = Math.max(
      0,
      allPosts.length - POSTS_PER_LOAD
    );

    nextIndex = start;

    renderPosts(allPosts.slice(start));

    allLoaded = nextIndex === 0;

    statusEl.remove();

    const moveToLatest = () => {
      // 保存済みスクロール位置や復元位置を使わず、常に最新投稿の末尾へ移動
      mainEl.scrollTop = mainEl.scrollHeight;
      updateBottomButton();
    };

    // 描画直後に最新位置へ移動し、画像読み込み後も位置を維持
    requestAnimationFrame(() => {
      moveToLatest();

      const visibleImages = Array.from(
        postsEl.querySelectorAll('.post-image')
      );

      visibleImages.forEach(image => {
        if (image.complete) return;

        const keepLatest = () => {
          // キャッシュ済み画像・遅延画像のどちらでも、読み込み完了ごとに末尾へ合わせる
          moveToLatest();
        };

        image.addEventListener('load', keepLatest, { once: true });
        image.addEventListener('error', keepLatest, { once: true });
      });

      requestAnimationFrame(moveToLatest);
    });
  }

  /* ========================================
     古い投稿を追加読み込み
  ======================================== */

  async function loadOlderPosts() {

    if (loadingOlder || allLoaded) return;

    loadingOlder = true;

    olderLoader.classList.add('show');

    await new Promise(resolve => {
      requestAnimationFrame(resolve);
    });

    try {

      const oldHeight = mainEl.scrollHeight;
      const oldTop = mainEl.scrollTop;

      const start = Math.max(
        0,
        nextIndex - POSTS_PER_LOAD
      );

      const olderPosts = allPosts.slice(
        start,
        nextIndex
      );

      if (!olderPosts.length) {

        allLoaded = true;

        return;
      }

      renderPosts(olderPosts, true);

      nextIndex = start;

      if (nextIndex === 0) {
        allLoaded = true;
      }

      requestAnimationFrame(() => {

        mainEl.scrollTop =
          oldTop + (mainEl.scrollHeight - oldHeight);

        updateBottomButton();
      });

    } catch (error) {

      console.error(
        '古い投稿の追加エラー:',
        error
      );

    } finally {

      olderLoader.classList.remove('show');

      loadingOlder = false;
    }
  }

  /* ========================================
     スクロールイベント
  ======================================== */

  mainEl.addEventListener('scroll', () => {

    if (
      mainEl.scrollTop < 150 &&
      !loadingOlder &&
      !allLoaded
    ) {
      loadOlderPosts();
    }

    updateBottomButton();
  });

  /* ========================================
     最新の投稿へ戻る
  ======================================== */

  toBottom.addEventListener('click', () => {

    mainEl.scrollTo({
      top: mainEl.scrollHeight,
      behavior: 'smooth'
    });
  });

  // BFCacheから復帰した場合も、以前の位置ではなく最新投稿へ移動する
  window.addEventListener('pageshow', () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (allPosts.length) {
          mainEl.scrollTop = mainEl.scrollHeight;
          updateBottomButton();
        }
      });
    });
  });

  /* ========================================
     投稿データ取得
  ======================================== */

  async function loadPosts() {

    try {

      /* 対応するJSだけを読み込む */

      await loadSourceScript();

      const source =
        window.TALK_SOURCES &&
        window.TALK_SOURCES[room.source];

      if (!source || !source.csvUrl) {
        throw new Error(
          'データソース設定が見つかりません。'
        );
      }

      /* CSV取得 */

      const response = await fetch(
        source.csvUrl,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rows = parseCSV(
        await response.text()
      );

      if (rows.length < 2) {

        statusEl.className = 'empty';
        statusEl.textContent = '表示できる投稿がありません。';

        return;
      }

      /* ========================================
         列の特定
      ======================================== */

      const headers = rows[0];

      const dateIndex = findColumn(
        headers,
        ['日時', '日付', 'timestamp']
      );

      const fromIndex = findColumn(
        headers,
        ['from', '投稿者', '名前']
      );

      const imageIndex = findColumn(
        headers,
        ['画像URL', '画像 url', '画像', 'image', 'imageurl']
      );

      const groupIndex = findColumn(
        headers,
        ['グループ', 'group']
      );

      const messageIndex = findColumn(
        headers,
        ['text', '本文', 'メッセージ', 'テキスト', '内容', 'message']
      );

      // 新しいスプレッドシート形式のメンバー列も取得
      const memberIndex = findColumn(
        headers,
        ['メンバー', 'member']
      );

      /* ========================================
         必須列チェック
      ======================================== */

      if (dateIndex === -1 || fromIndex === -1) {

        throw new Error(
          '必要な列（日時 / from）が見つかりません。CSVの1行目を確認してください。'
        );
      }

      if (source.filterByGroup && groupIndex === -1) {

        throw new Error(
          '必要な列（グループ）が見つかりません。'
        );
      }

      if (imageIndex === -1 && messageIndex === -1) {

        throw new Error(
          '画像URLまたは本文の列が見つかりません。'
        );
      }

      /* ========================================
         グループ名の正規化
      ======================================== */

      const normalizeGroup = value => {

        const group = String(value || '')
          .replace(/^\uFEFF/, '')
          .replace(/\s/g, '')
          .toLowerCase();

        const aliases = {

          '乃木坂46': 'nogizaka46',
          'nogizaka46': 'nogizaka46',

          '櫻坂46': 'sakurazaka46',
          '桜坂46': 'sakurazaka46',
          'sakurazaka46': 'sakurazaka46',

          '日向坂46': 'hinatazaka46',
          'hinatazaka46': 'hinatazaka46'
        };

        return aliases[group] || group;
      };

      /* ========================================
         投稿データ作成
      ======================================== */

      allPosts = rows.slice(1)
        .map(row => ({

          date: row[dateIndex] || '',

          from: String(
            row[fromIndex] || ''
          ).trim(),

          image: imageIndex === -1
            ? ''
            : safeImageUrl(row[imageIndex]),

          group: groupIndex === -1
            ? ''
            : normalizeGroup(row[groupIndex]),

          member: memberIndex === -1
            ? ''
            : String(row[memberIndex] || '').trim(),

          message: messageIndex === -1
            ? ''
            : String(row[messageIndex] || '').trim()

        }))
        .filter(item => {

          const groupMatches =
            !source.filterByGroup ||
            item.group === room.group;

          return (
            item.from &&
            groupMatches &&
            (item.image || item.message)
          );
        });

      /* ========================================
         日付順に並べ替え
      ======================================== */

      allPosts.sort((a, b) => {

        const da = dateValue(a.date);
        const db = dateValue(b.date);

        if (
          !Number.isNaN(da) &&
          !Number.isNaN(db)
        ) {
          return da - db;
        }

        return String(a.date).localeCompare(
          String(b.date),
          'ja'
        );
      });

      /* ========================================
         投稿がない場合
      ======================================== */

      if (!allPosts.length) {

        statusEl.className = 'empty';

        statusEl.textContent = source.filterByGroup
          ? 'このグループの投稿はありません。'
          : '表示できる投稿がありません。';

        return;
      }

      /* ========================================
         初回表示
      ======================================== */

      renderInitialPosts();

    } catch (error) {

      statusEl.className = 'error';

      statusEl.textContent =
        `投稿を取得できませんでした。\n` +
        `${error.message}\n\n` +
        `スプレッドシートがウェブに公開されているか、` +
        `列名・ファイル配置が正しいか確認してください。`;

      console.error(error);
    }
  }

  /* ========================================
     起動
  ======================================== */

  loadPosts();

})();
