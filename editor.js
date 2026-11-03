/* ==========================================================
   編集モード（ローカル専用）
   - file:// か localhost で開いたときだけ「編集」ボタンを表示
   - 文字を選ぶと書式ツールバー（太字・色・大きさ・フォント・見出しの種類）
   - 「＋挿入」でテキストボックス・写真・文章を追加
   - セクション・テキストボックス・写真をクリックすると操作バー（背景色・移動・削除など）
   - 「デザイン」パネルでサイト全体の色・フォントを変更（style.css に保存）
   - 保存は Chrome の File System Access API で元の HTML / CSS / 画像を上書き
   ========================================================== */
(function () {
  "use strict";

  // 公開サイトでは何もしない
  var isLocal =
    location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "[::1]"].indexOf(location.hostname) !== -1;
  if (!isLocal) return;

  // 編集できる要素（ヘッダー・フッター・メニューは全ページ共通なので対象外）
  var EDITABLE = [
    "main h1",
    "main h2",
    "main h3",
    "main p",
    "main summary",
    "main figcaption",
    "main .hero-label",
    "main .card-step",
    "main li:not(:has(> a, > p, > div, > ul, > ol, > h2, > h3))",
    "main th",
    "main td"
  ].join(", ");

  /* ---------- 挿入できる図・表 ---------- */
  var COMPONENTS = [
    { label: "チェックリスト", html: '<ul class="checklist"><li>チェック項目1</li><li>チェック項目2</li><li>チェック項目3</li></ul>' },
    { label: "箇条書き", html: '<ul class="bullet-list"><li>項目1</li><li>項目2</li><li>項目3</li></ul>' },
    { label: "番号付きリスト", html: '<ol class="num-list"><li>手順1</li><li>手順2</li><li>手順3</li></ol>' },
    { label: "流れ（手順の図）", html: '<ol class="flow"><li>準備</li><li>踏み切り</li><li>着地</li></ol>' },
    {
      label: "表",
      html: '<div class="table-wrap"><table class="table">' +
        "<thead><tr><th>項目</th><th>内容</th></tr></thead>" +
        "<tbody><tr><td>ここに入力</td><td>ここに入力</td></tr><tr><td>ここに入力</td><td>ここに入力</td></tr></tbody>" +
        "</table></div>"
    },
    {
      label: "比較（良い例・悪い例）",
      html: '<div class="compare">' +
        '<div class="compare-col compare-col--good"><p class="compare-title">○ 良い例</p><ul class="bullet-list"><li>ここに入力</li></ul></div>' +
        '<div class="compare-col compare-col--bad"><p class="compare-title">× 悪い例</p><ul class="bullet-list"><li>ここに入力</li></ul></div>' +
        "</div>"
    },
    { label: "区切り線", html: '<hr class="divider">' }
  ];

  // リストの種類（切り替えられる）
  var LIST_TYPES = [
    { value: "checklist", label: "チェックリスト", tag: "ul" },
    { value: "bullet-list", label: "箇条書き", tag: "ul" },
    { value: "num-list", label: "番号付き", tag: "ol" },
    { value: "flow", label: "流れ（手順の図）", tag: "ol" }
  ];

  // 見出しの種類を切り替えられる要素（本文エリアの見出し・段落だけ）
  var BLOCK_SELECTOR = "main .section .container > :is(h2, h3, p)";
  var BLOCK_TYPES = [
    { value: "h2", label: "大見出し" },
    { value: "h3", label: "中見出し" },
    { value: "p", label: "本文" }
  ];

  // 挿入できる場所（各セクションの中身）
  var CONTAINER = "main .section .container";

  /* ---------- フォント・色の選択肢 ---------- */
  var SYSTEM_FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif';
  var FONTS = [
    { label: "標準（ゴシック）", value: SYSTEM_FONT },
    { label: "Noto Sans JP（すっきりゴシック）", name: "Noto Sans JP", value: '"Noto Sans JP", sans-serif' },
    { label: "Zen角ゴシック（やわらかゴシック）", name: "Zen Kaku Gothic New", value: '"Zen Kaku Gothic New", sans-serif' },
    { label: "M PLUS Rounded（丸ゴシック）", name: "M PLUS Rounded 1c", value: '"M PLUS Rounded 1c", sans-serif' },
    { label: "Zen丸ゴシック（やさしい丸文字）", name: "Zen Maru Gothic", value: '"Zen Maru Gothic", sans-serif' },
    { label: "Noto Serif JP（明朝）", name: "Noto Serif JP", value: '"Noto Serif JP", serif' }
  ];

  var SIZES = [
    { value: "0.85em", label: "小さく" },
    { value: "", label: "標準に戻す" },
    { value: "1.2em", label: "やや大きく" },
    { value: "1.5em", label: "大きく" },
    { value: "2em", label: "とても大きく" }
  ];

  // 文字色（メインカラーを選ぶと、デザインの色を変えたときに一緒に変わる）
  var TEXT_COLORS = [
    { value: "var(--c-primary)", label: "メインカラー" },
    { value: "var(--c-primary-dark)", label: "濃いメインカラー" },
    { value: "#e53935", label: "赤" },
    { value: "#f57c00", label: "オレンジ" },
    { value: "#2e9d5b", label: "緑" },
    { value: "#7b4ddb", label: "紫" },
    { value: "#e8437a", label: "ピンク" },
    { value: "#1b2a3d", label: "黒" },
    { value: "#5b6b80", label: "グレー" }
  ];

  // セクション・テキストボックスの背景色（文字が読みやすい薄い色）
  var BLOCK_BGS = [
    { value: "var(--c-sky)", label: "メインカラーの薄い色" },
    { value: "#ffffff", label: "白" },
    { value: "#f4f6f9", label: "薄いグレー" },
    { value: "#fffbeb", label: "薄い黄色" },
    { value: "#fff3ee", label: "薄いオレンジ" },
    { value: "#fff0f4", label: "薄いピンク" },
    { value: "#eef8f1", label: "薄い緑" },
    { value: "#f3efff", label: "薄い紫" },
    { value: "#e8f6f8", label: "薄い水色" }
  ];

  var THEME_COLORS = [
    { value: "#0a6cff", label: "青" },
    { value: "#0097a7", label: "青緑" },
    { value: "#2e9d5b", label: "緑" },
    { value: "#f57c00", label: "オレンジ" },
    { value: "#e53935", label: "赤" },
    { value: "#e8437a", label: "ピンク" },
    { value: "#7b4ddb", label: "紫" },
    { value: "#37474f", label: "チャコール" }
  ];

  var BG_COLORS = [
    { value: "#ffffff", label: "白" },
    { value: "#fbf9f4", label: "オフホワイト" },
    { value: "#f4f6f9", label: "薄いグレー" },
    { value: "#f2f7ff", label: "薄い青" },
    { value: "#fffbeb", label: "薄い黄色" }
  ];

  var BOX_TYPES = [
    { value: "", label: "ポイント" },
    { value: "box--warn", label: "注意" },
    { value: "box--plain", label: "シンプル" }
  ];

  // テキストボックスの幅（セクションの幅に対する割合。ドラッグでも変えられる）
  var BOX_WIDTHS = [
    { value: "40", label: "幅 40%" },
    { value: "60", label: "幅 60%" },
    { value: "80", label: "幅 80%" },
    { value: "100", label: "横いっぱい" }
  ];

  // コピーしたテキストボックス・写真（別のページにも貼り付けられるようにブラウザに記憶）
  var CLIP_KEY = "bakuten-editor-clipboard";

  var PHOTO_SIZES = [
    { value: "photo--s", label: "小" },
    { value: "photo--m", label: "中" },
    { value: "photo--l", label: "大（横いっぱい）" }
  ];

  var DEFAULT_DESIGN = {
    primary: "#0a6cff",
    dark: "#0049b8",
    accent: "#00c2e0",
    bg: "#ffffff",
    heading: SYSTEM_FONT,
    body: SYSTEM_FONT
  };

  // style.css の中で書き換える範囲
  var DESIGN_RE = /\/\* ===== デザイン設定（[\s\S]*?デザイン設定ここまで ===== \*\//;

  // 写真は横幅をこれ以下に縮小して images フォルダに保存する
  var IMAGE_DIR = "images";
  // 動画はそのまま videos フォルダに保存する（大きいときは注意を出す）
  var VIDEO_DIR = "videos";
  var VIDEO_WARN_SIZE = 50 * 1024 * 1024;
  // 種類の情報がないファイル（Windows で .MOV など）も、拡張子で動画と判断する
  var VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|ogv|3gp)$/i;
  var VIDEO_ACCEPT = "video/*,.mp4,.m4v,.mov,.webm";
  var IMAGE_MAX_WIDTH = 1600;

  var DB_NAME = "bakuten-editor";
  var STORE = "handles";
  var KEY = "siteDir";

  var mainEl = document.querySelector("main");
  // ファイルを読み込んだ時点の本文（別の場所で書き換えられていないかの確認用）
  var loadedMain = mainEl ? mainEl.innerHTML : "";

  var editing = false;
  var dirty = false;        // ページの文章・書式・挿入の変更
  var designDirty = false;  // デザイン設定の変更
  var pendingImages = {};   // まだ保存していない写真（blob URL → { blob, name }）
  var design = null;
  var savedRange = null;
  var currentHost = null;
  var selBlock = null;      // 選択中のセクション・テキストボックス・写真
  var clipHtml = "";        // ブラウザに記憶できなかったときのコピー内容
  var bar, editBtn, insertBtn, insertMenu, pasteItem, designBtn, saveBtn, exitBtn, toast;
  var toolbar, tools = {}, colorBox;
  var blockBar, sizeSel, handles = {}, sizeBadge;
  var panel, panelInputs = {};

  function fileName() {
    var name = decodeURIComponent(location.pathname.split("/").pop());
    return name || "index.html";
  }

  /* ---------- UI ---------- */
  function buildUI() {
    bar = el("div", "editor-bar");

    editBtn = button("編集", "editor-btn", startEdit);
    designBtn = button("デザイン", "editor-btn editor-btn--design", togglePanel);
    saveBtn = button("保存", "editor-btn editor-btn--save", save);
    exitBtn = button("終了", "editor-btn editor-btn--exit", exitEdit);
    designBtn.setAttribute("aria-expanded", "false");

    // 「＋挿入」メニュー
    var insertWrap = el("div", "editor-insert");
    insertBtn = button("＋挿入", "editor-btn editor-btn--design", function () {
      pasteItem.disabled = !getClip();
      insertMenu.hidden = !insertMenu.hidden;
      insertBtn.setAttribute("aria-expanded", String(!insertMenu.hidden));
    });
    insertBtn.setAttribute("aria-expanded", "false");
    insertMenu = el("div", "editor-insert-menu");
    insertMenu.hidden = true;
    pasteItem = button("貼り付け（コピーしたもの）", "editor-menu-item", function () { closeInsertMenu(); pasteBlock(); });
    insertMenu.append(
      button("テキストボックス", "editor-menu-item", function () { closeInsertMenu(); insertTextBox(); }),
      button("写真（複数可）", "editor-menu-item", function () { closeInsertMenu(); insertPhoto(); }),
      button("動画（自分で撮った動画・複数可）", "editor-menu-item", function () { closeInsertMenu(); insertVideo(); }),
      button("動画（YouTube のURLで埋め込む）", "editor-menu-item", function () { closeInsertMenu(); insertYouTube(); }),
      button("文章（段落）", "editor-menu-item", function () { closeInsertMenu(); insertParagraph(); }),
      el("p", "editor-menu-heading", "図・表")
    );
    COMPONENTS.forEach(function (c) {
      insertMenu.appendChild(button(c.label, "editor-menu-item", function () {
        closeInsertMenu();
        insertComponent(c.html);
      }));
    });
    insertMenu.append(el("p", "editor-menu-heading", "コピーしたもの"), pasteItem);
    insertWrap.append(insertMenu, insertBtn);

    toast = el("div", "editor-toast");
    toast.setAttribute("role", "status");
    toast.hidden = true;

    bar.append(toast, exitBtn, insertWrap, designBtn, saveBtn, editBtn);
    // 押しても文章のカーソル位置が外れないようにする
    bar.addEventListener("mousedown", function (e) {
      if (e.target.closest(".editor-insert")) e.preventDefault();
    });
    setEditButtons(false);
    document.body.append(bar, buildToolbar(), buildBlockBar(), buildHandles(), buildPanel());
  }

  function setEditButtons(on) {
    editBtn.hidden = on;
    insertBtn.parentElement.hidden = designBtn.hidden = saveBtn.hidden = exitBtn.hidden = !on;
  }

  function closeInsertMenu() {
    insertMenu.hidden = true;
    insertBtn.setAttribute("aria-expanded", "false");
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function button(label, cls, onClick, title) {
    var b = el("button", cls, label);
    b.type = "button";
    if (title) b.title = b.ariaLabel = title;
    b.addEventListener("click", onClick);
    return b;
  }

  function selectBox(title, placeholder, options, onChange) {
    var s = el("select", "editor-select");
    s.title = s.ariaLabel = title;
    if (placeholder) {
      var p = el("option", "", placeholder);
      p.value = "__placeholder";
      p.disabled = true;
      s.appendChild(p);
    }
    options.forEach(function (o) {
      var opt = el("option", "", o.label);
      opt.value = o.value;
      if (o.font) opt.style.fontFamily = o.font;
      s.appendChild(opt);
    });
    s.addEventListener("change", function () { onChange(s.value, s); });
    return s;
  }

  function swatch(color, label, onClick) {
    var b = button("", "editor-swatch", onClick, label);
    b.style.background = color;
    return b;
  }

  // 色のパレット（ボタンを押すと開く）。value が空なら「元に戻す」
  function colorPicker(buttonLabel, buttonClass, title, colors, resetLabel, onPick) {
    var wrap = el("div", "editor-color-wrap");
    var box = el("div", "editor-colors");
    box.hidden = true;
    var btn = button(buttonLabel, buttonClass, function () { box.hidden = !box.hidden; }, title);
    function pick(v) {
      box.hidden = true;
      onPick(v);
    }
    colors.forEach(function (c) {
      box.appendChild(swatch(c.value, c.label, function () { pick(c.value); }));
    });
    box.appendChild(button("✕", "editor-swatch editor-swatch--reset", function () { pick(""); }, resetLabel));
    var custom = el("label", "", "ほかの色：");
    var input = el("input");
    input.type = "color";
    input.value = "#e53935";
    input.addEventListener("change", function () { pick(input.value); });
    custom.appendChild(input);
    box.appendChild(custom);
    wrap.append(btn, box);
    return { wrap: wrap, box: box };
  }

  var toastTimer;
  function notify(msg, isError) {
    toast.textContent = msg;
    toast.classList.toggle("editor-toast--error", !!isError);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, isError ? 6000 : 3000);
  }

  // ボタンを押しても文字の選択が外れないようにする
  function keepSelection(container) {
    container.addEventListener("mousedown", function (e) {
      if (!e.target.closest("select, input, label")) e.preventDefault();
    });
  }

  /* ---------- 書式ツールバー ---------- */
  function buildToolbar() {
    toolbar = el("div", "editor-toolbar");
    toolbar.setAttribute("role", "toolbar");
    toolbar.ariaLabel = "書式";
    toolbar.hidden = true;

    tools.bold = button("B", "editor-tool editor-tool--b", function () { exec("bold"); }, "太字（Ctrl+B）");
    tools.italic = button("I", "editor-tool editor-tool--i", function () { exec("italic"); }, "斜体（Ctrl+I）");
    tools.underline = button("U", "editor-tool editor-tool--u", function () { exec("underline"); }, "下線（Ctrl+U）");

    var color = colorPicker("A", "editor-tool editor-tool--color", "文字の色", TEXT_COLORS, "元の色に戻す",
      function (v) { applyStyle("color", v); });
    colorBox = color.box;

    tools.size = selectBox("文字の大きさ", "大きさ", SIZES, function (v, s) {
      applyStyle("fontSize", v);
      s.value = "__placeholder";
    });
    tools.font = selectBox("フォント", "フォント", FONTS.map(function (f) {
      return { value: f.value, label: f.label, font: f.value };
    }), function (v, s) {
      // 「標準」を選んだときはフォント指定を外す
      applyStyle("fontFamily", v === SYSTEM_FONT ? "" : v);
      s.value = "__placeholder";
    });
    tools.block = selectBox("見出しの種類", "種類", BLOCK_TYPES, changeBlock);

    var clear = button("書式クリア", "editor-tool", function () { exec("removeFormat"); }, "選んだ部分の書式をすべて外す");

    toolbar.append(
      tools.bold, tools.italic, tools.underline, el("span", "editor-sep"),
      color.wrap, tools.size, tools.font, el("span", "editor-sep"),
      tools.block, clear
    );
    keepSelection(toolbar);
    return toolbar;
  }

  // 文字の選択が変わるたびにツールバーを出す／隠す
  function onSelectionChange() {
    if (!editing) return;
    var sel = getSelection();
    if (sel.rangeCount) {
      var host = hostOf(sel.anchorNode);
      if (host && host === hostOf(sel.focusNode)) {
        savedRange = sel.getRangeAt(0).cloneRange();
        currentHost = host;
        if (!sel.isCollapsed) {
          showToolbar();
          return;
        }
      }
    }
    // ツールバーのメニューや色選びを操作している間は閉じない
    if (toolbar.contains(document.activeElement)) return;
    hideToolbar();
  }

  function hostOf(node) {
    var e = node && (node.nodeType === 1 ? node : node.parentElement);
    return e && e.closest('[contenteditable="true"]');
  }

  function showToolbar() {
    toolbar.hidden = false;
    updateToolbarState();
    positionToolbar();
  }

  function hideToolbar() {
    toolbar.hidden = true;
    colorBox.hidden = true;
  }

  function positionToolbar() {
    if (toolbar.hidden || !savedRange) return;
    var r = savedRange.getBoundingClientRect();
    if (!r.width && !r.height) r = currentHost.getBoundingClientRect();
    var t = toolbar.getBoundingClientRect();
    var top = r.top - t.height - 10;
    var left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
    // 上に入らないときや、操作バー（削除ボタンなど）を隠してしまうときは文字の下に出す
    if (top < 8 || overlapsBlockBar(left, top, t.width, t.height)) top = r.bottom + 10;
    toolbar.style.top = top + "px";
    toolbar.style.left = left + "px";
  }

  function overlapsBlockBar(left, top, width, height) {
    if (blockBar.hidden || blockBar.style.visibility === "hidden") return false;
    var b = blockBar.getBoundingClientRect();
    return left < b.right && left + width > b.left && top < b.bottom && top + height > b.top;
  }

  function updateToolbarState() {
    ["bold", "italic", "underline"].forEach(function (cmd) {
      tools[cmd].classList.toggle("is-active", document.queryCommandState(cmd));
    });
    var canChange = !!currentHost && currentHost.matches(BLOCK_SELECTOR);
    tools.block.disabled = !canChange;
    tools.block.value = canChange ? currentHost.tagName.toLowerCase() : "__placeholder";
  }

  // ツールバー操作でフォーカスが移ったあと、元の選択範囲に戻す
  function restoreSelection() {
    if (!savedRange || !currentHost || !currentHost.isConnected) return false;
    currentHost.focus({ preventScroll: true });
    var sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  }

  function exec(cmd) {
    if (!restoreSelection()) return;
    document.execCommand(cmd);
    dirty = true;
    updateToolbarState();
  }

  // 選んだ文字を <span style="..."> で囲む（value が空なら指定を外す）
  function applyStyle(prop, value) {
    if (!restoreSelection() || savedRange.collapsed) return;
    var host = currentHost;
    var range = savedRange;

    var frag = range.extractContents();
    // 中にある同じ指定は外す（重ねがけで入れ子にならないように）
    frag.querySelectorAll("[style]").forEach(function (e) {
      e.style[prop] = "";
      if (!e.getAttribute("style") && e.tagName === "SPAN") unwrap(e);
    });
    var span = el("span");
    span.appendChild(frag);
    range.insertNode(span);

    // 同じ文字だけを囲んでいる外側の span があれば、そちらにまとめる
    var p = span.parentElement;
    while (p && p !== host && p.tagName === "SPAN" && p.textContent === span.textContent) {
      p.style[prop] = "";
      unwrap(span);
      span = p;
      p = span.parentElement;
    }
    span.style[prop] = value;

    // 選択し直して、続けて別の書式もかけられるようにする
    range = document.createRange();
    range.setStartBefore(span);
    range.setEndAfter(span);
    if (!span.getAttribute("style")) unwrap(span);
    removeEmpty(host);
    var sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange = range.cloneRange();
    dirty = true;
  }

  function unwrap(e) {
    e.replaceWith.apply(e, Array.from(e.childNodes));
  }

  function removeEmpty(host) {
    host.querySelectorAll("span, b, i, u, strong, em, font").forEach(function (e) {
      if (!e.textContent && !e.querySelector("br, img")) e.remove();
    });
  }

  // 見出しの種類（大見出し・中見出し・本文）を切り替える
  function changeBlock(tag) {
    var old = currentHost;
    if (!old || !old.matches(BLOCK_SELECTOR) || old.tagName.toLowerCase() === tag) return;
    var e = el(tag, tag === "h2" ? "section-title" : "");
    e.innerHTML = old.innerHTML;
    old.replaceWith(e);
    makeEditable(e);
    currentHost = e;
    selectText(e);
    dirty = true;
    showToolbar();
  }

  function makeEditable(root) {
    [root].concat(Array.from(root.querySelectorAll("*"))).forEach(function (e) {
      if (e.matches(EDITABLE)) {
        e.contentEditable = "true";
        e.spellcheck = false;
      }
    });
  }

  // 要素の文字をすべて選んだ状態にする（そのまま打てば置き換わる）
  function selectText(e) {
    var range = document.createRange();
    range.selectNodeContents(e);
    savedRange = range;
    currentHost = e;
    restoreSelection();
  }

  /* ---------- 挿入（テキストボックス・写真・文章） ---------- */
  // 挿入する場所：選択中の写真・ボックスの後ろ／カーソルのある段落の後ろ／選択中セクションの最後
  // node：これから入れるもの（省略時は、どこかに入れられるかだけを調べる）
  function insertionPoint(node) {
    // 写真・動画は、操作バーの「＋写真」「＋動画」と同じ場所に入れる
    if (node && node.matches("figure.photo") && selBlock && selBlock.isConnected) return mediaSpot(selBlock);
    var host = currentHost && currentHost.isConnected ? currentHost : null;
    // テキストボックスの中を選んでいるときは、写真・動画・文章などはボックスの中に入れる
    // （セクションの余白をクリックしたあとは、前にカーソルがあったボックスには入れない）
    var ref = selBlock ? (selBlock.matches(".section") ? null : selBlock) : host;
    var box = ref && ref.closest("main .box");
    if (box && (!node || canGoInBox(node))) {
      var inner = ref === box ? null : childOf(box, ref);
      return inner ? { after: inner } : { append: box };
    }
    if (selBlock && !selBlock.matches(".section")) {
      // カードの中の文字を選んでいるときはカードの後ろ、ほかの文字ならそのまとまりの後ろ
      // （ボックスや比較の中のリストなどを選んでいるときは、外側のまとまりの後ろ）
      var card = selBlock.closest(".card-grid > li");
      if (card) return { after: card };
      var top = topBlock(selBlock);
      return top ? { after: top } : null;
    }
    if (host && (!selBlock || selBlock.contains(host))) {
      var top = topBlock(host);
      if (top) return { after: top };
    }
    if (selBlock) {
      var c = selBlock.querySelector(".container");
      if (c) return { append: c };
    }
    return null;
  }

  // セクションの中身の直下にある要素までさかのぼる
  function topBlock(node) {
    var e = node;
    while (e && e.parentElement && !e.parentElement.matches(CONTAINER)) e = e.parentElement;
    return e && e.parentElement ? e : null;
  }

  // ボックスの中に入れられるもの（ボックス・カード・比較・画像の枠は入れ子にしない）
  function canGoInBox(node) {
    if (node.tagName === "LI") return false;
    return !node.matches(".box, .card-grid, .compare, .placeholder-media");
  }

  // ボックスの直下にある要素までさかのぼる
  function childOf(box, node) {
    var e = node;
    while (e && e.parentElement !== box) e = e.parentElement;
    return e;
  }

  function insertBlock(node) {
    var pt = insertionPoint(node);
    if (!pt) {
      notify("先に、挿入したい場所の文章かセクションをクリックしてください", true);
      return false;
    }
    // カードはカードの並び（card-grid）の中に入れる。並びの外なら新しい並びを作る
    var isCard = node.tagName === "LI" && !!node.querySelector(".card");
    var inGrid = !!pt.after && pt.after.parentElement.matches(".card-grid");
    var outer = node;
    if (isCard && !inGrid) {
      outer = el("ul", "card-grid");
      outer.appendChild(node);
    }
    if (!isCard && inGrid) pt = { after: pt.after.parentElement };
    if (pt.after) pt.after.after(outer);
    else pt.append.appendChild(outer);
    makeEditable(outer);
    dirty = true;
    node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return true;
  }

  function insertTextBox() {
    var box = el("div", "box");
    var title = el("p", "box-title", "タイトル");
    var body = el("p", "", "ここに文章を入力してください。");
    box.append(title, body);
    if (!insertBlock(box)) return;
    selectBlock(box);
    selectText(title);
  }

  // 図・表を入れて、最初の文字を選んだ状態にする（そのまま打てば置き換わる）
  function insertComponent(html) {
    var t = el("template");
    t.innerHTML = html;
    var node = t.content.firstElementChild;
    if (!insertBlock(node)) return;
    selectBlock(node);
    var first = node.querySelector('[contenteditable="true"]');
    if (first) selectText(first);
  }

  function insertParagraph() {
    var p = el("p", "", "ここに文章を入力してください。");
    if (!insertBlock(p)) return;
    selectBlock(p);
    selectText(p);
  }

  /* ---------- 写真・動画 ---------- */
  function insertPhoto() {
    insertMediaFiles("image/*", true);
  }

  function insertVideo() {
    insertMediaFiles(VIDEO_ACCEPT, true);
  }

  function insertMediaFiles(accept, multiple) {
    if (!insertionPoint()) {
      notify("先に、挿入したい場所の文章かセクションをクリックしてください", true);
      return;
    }
    pickFiles(accept, multiple, insertFiles);
  }

  // 選んだ（またはドロップした）写真・動画を順番に入れる
  async function insertFiles(files) {
    var count = 0;
    for (var i = 0; i < files.length; i++) {
      var fig = await mediaFigure(files[i]);
      if (!fig || !insertBlock(fig)) continue;
      // 次のファイルはこの後ろに入る
      selectBlock(fig);
      count++;
    }
    if (count) notify(count + "件入れました。「保存」で images・videos フォルダに保存されます");
  }

  // 選んでいるものに対して、写真・動画を入れる場所
  // ボックス・セクション・カード・FAQ → その中の一番下
  // 文章・見出しなど → そのすぐ下（ボックスや比較の枠の中なら、その中）
  // リストの項目・表のマス・質問・写真の説明 → リスト・表・FAQ・写真のすぐ下（中には入れられないため）
  function mediaSpot(b) {
    var kind = kindOf(b);
    if (kind === "box") return { append: b };
    if (kind === "section") return { append: b.querySelector(".container") || b };
    if (kind === "card") return { append: b.querySelector(".card") || b };
    if (kind === "faq") return { append: b.querySelector(".faq-answer") || b };
    if (b.closest(".card") && kind === "text") return { after: b };
    // リストの項目（流れ図の箱・チェックリストの行など）は、その項目の中に入れる
    var item = b.closest("li");
    if (item && !item.matches(".card-grid > li")) {
      if (kind === "photo") return { after: b };
      return { append: itemContainer(item) };
    }
    var anchor = b;
    if (anchor.closest("summary")) anchor = anchor.closest("details");
    anchor = anchor.closest(".table-wrap") || anchor;
    anchor = anchor.closest("figure") || anchor;
    // 入れ子のリストでも、一番外側のリストの後ろにする
    var list = anchor.closest("ul:not(.card-grid), ol");
    while (list) {
      anchor = list;
      list = list.parentElement.closest("ul:not(.card-grid), ol");
    }
    return { after: anchor };
  }

  // 文字だけの項目 <li>文字</li> を、写真も入れられる形 <li><p>文字</p>…</li> にする
  function itemContainer(li) {
    if (li.getAttribute("contenteditable") === "true") {
      var p = el("p", "item-text");
      while (li.firstChild) p.appendChild(li.firstChild);
      li.removeAttribute("contenteditable");
      li.removeAttribute("spellcheck");
      li.appendChild(p);
      makeEditable(p);
      if (currentHost === li) currentHost = savedRange = null;
    }
    return li;
  }

  // 写真・動画を選んでもらい、spot（mediaSpot の結果）に順番に入れる
  function insertMediaInto(spot, accept) {
    pickFiles(accept, true, async function (files) {
      var ref = spot.after || null;
      var count = 0;
      for (var i = 0; i < files.length; i++) {
        var fig = await mediaFigure(files[i]);
        if (!fig) continue;
        if (ref && ref.isConnected) ref.after(fig);
        else spot.append.appendChild(fig);
        makeEditable(fig);
        ref = fig;
        count++;
      }
      if (!count) return;
      dirty = true;
      selectBlock(ref);
      ref.scrollIntoView({ block: "nearest", behavior: "smooth" });
      notify(count + "件入れました。「保存」で images・videos フォルダに保存されます");
    });
  }

  // 「画像・動画が入ります」の枠を写真・動画に置き換える
  function replaceWithMedia(target, accept) {
    pickFiles(accept, false, async function (files) {
      var fig = await mediaFigure(files[0]);
      if (!fig) return;
      target.replaceWith(fig);
      makeEditable(fig);
      dirty = true;
      selectBlock(fig);
    });
  }

  function pickFiles(accept, multiple, onPicked) {
    var input = el("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener("change", function () {
      if (input.files.length) onPicked(Array.from(input.files));
    });
    input.click();
  }

  // ファイルから <figure> を作る（ファイルへの書き込みは保存時）。使えないファイルなら null
  async function mediaFigure(file) {
    var fig = el("figure", "photo photo--m");
    try {
      if (file.type.indexOf("image/") === 0) {
        var img = await prepareImage(file);
        var image = el("img");
        image.src = addPending(img.blob, img.name, IMAGE_DIR);
        image.alt = "";
        fig.appendChild(image);
      } else if (isVideoFile(file)) {
        var video = await prepareVideo(file);
        var v = el("video");
        v.src = addPending(file, video.name, VIDEO_DIR);
        v.controls = true;
        v.playsInline = true;
        v.preload = "metadata";
        fig.classList.add("media-video");
        fig.appendChild(v);
      } else {
        throw new Error("写真か動画のファイルを選んでください");
      }
    } catch (e) {
      notify(file.name + "：" + e.message, true);
      return null;
    }
    fig.appendChild(el("figcaption"));
    return fig;
  }

  function addPending(blob, name, dirName) {
    var url = URL.createObjectURL(blob);
    pendingImages[url] = { blob: blob, name: name, dir: dirName };
    return url;
  }

  function fileBase(prefix) {
    var stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    return prefix + "-" + stamp + "-" + Math.random().toString(36).slice(2, 6);
  }

  function isVideoFile(file) {
    return file.type.indexOf("video/") === 0 || VIDEO_EXT_RE.test(file.name);
  }

  // スマホで撮った動画（iPhone の .MOV など）は、形式の名前だけでは再生できるか分からないので、
  // 実際に読み込んでみて、映像が出るかどうかで判断する
  async function prepareVideo(file) {
    if (!(await canPlayVideo(file))) {
      throw new Error("この動画はブラウザで再生できない形式です。" +
        "iPhone なら「設定 → カメラ → フォーマット → 互換性優先」で撮った動画か、MP4 に変換した動画を使ってください");
    }
    if (file.size > VIDEO_WARN_SIZE) {
      notify(file.name + " は大きいファイルです（" + Math.round(file.size / 1048576) +
        "MB）。公開するとページの表示が遅くなることがあるので、必要な部分だけに短く切るのがおすすめです");
    }
    var ext = (file.name.match(/\.(\w+)$/) || [])[1] || file.type.split("/")[1] || "mp4";
    return { name: fileBase("video") + "." + ext.toLowerCase() };
  }

  function canPlayVideo(file) {
    return new Promise(function (resolve) {
      var v = el("video");
      var url = URL.createObjectURL(file);
      var timer = setTimeout(function () { done(false); }, 10000);
      function done(ok) {
        clearTimeout(timer);
        v.removeAttribute("src");
        v.load();
        URL.revokeObjectURL(url);
        resolve(ok);
      }
      v.muted = true;
      v.preload = "auto";
      // 音だけ再生できて映像が出ない形式（HEVC など）は videoWidth が 0 になる
      v.onloadeddata = function () { done(v.videoWidth > 0); };
      v.onerror = function () { done(false); };
      v.src = url;
    });
  }

  // YouTube の動画を埋め込む
  function insertYouTube() {
    if (!insertionPoint()) {
      notify("先に、挿入したい場所の文章かセクションをクリックしてください", true);
      return;
    }
    var fig = youtubeFigure();
    if (fig && insertBlock(fig)) selectBlock(fig);
  }

  function youtubeFigure() {
    var url = prompt("YouTube の動画のURLを貼り付けてください\n（例：https://www.youtube.com/watch?v=… または https://youtu.be/…）");
    if (!url) return null;
    var m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
    if (!m) {
      notify("YouTube の動画のURLではないようです", true);
      return null;
    }
    // ショート動画は縦長で表示する
    var vertical = /\/shorts\//.test(url);
    var fig = el("figure", "photo media-embed " + (vertical ? "photo--s" : "photo--l"));
    var box = el("div", "video-embed" + (vertical ? " video-embed--vertical" : ""));
    var frame = el("iframe");
    frame.src = "https://www.youtube-nocookie.com/embed/" + m[1];
    frame.title = "YouTube動画";
    frame.loading = "lazy";
    frame.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    box.appendChild(frame);
    fig.append(box, el("figcaption"));
    return fig;
  }

  async function prepareImage(file) {
    var base = fileBase("photo");
    // GIF（動く画像）はそのまま使う
    if (file.type === "image/gif") return { blob: file, name: base + ".gif" };

    var bmp = await createImageBitmap(file).catch(function () {
      throw new Error("この写真は使えません（JPEG・PNG 形式の画像を選んでください）");
    });
    var scale = Math.min(1, IMAGE_MAX_WIDTH / bmp.width);
    var isPng = file.type === "image/png";
    if (scale === 1 && file.size < 1500000 && (isPng || file.type === "image/jpeg")) {
      bmp.close();
      return { blob: file, name: base + (isPng ? ".png" : ".jpg") };
    }
    var canvas = el("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    var type = isPng ? "image/png" : "image/jpeg";
    var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, type, 0.85); });
    if (!blob) throw new Error("画像を変換できませんでした");
    return { blob: blob, name: base + (isPng ? ".png" : ".jpg") };
  }

  /* ---------- 操作バー（セクション・テキストボックス・カード・写真） ---------- */
  function buildBlockBar() {
    blockBar = el("div", "editor-toolbar editor-blockbar");
    blockBar.setAttribute("role", "toolbar");
    blockBar.hidden = true;
    keepSelection(blockBar);
    return blockBar;
  }

  function kindOf(b) {
    if (b.getAttribute("contenteditable") === "true") return "text";
    if (b.matches(".photo")) return "photo";
    if (b.matches(".box")) return "box";
    if (b.matches(".card-grid > li")) return "card";
    if (b.matches("li")) return "item";
    if (b.matches(".placeholder-media")) return "placeholder";
    if (b.matches(".faq-item")) return "faq";
    if (b.matches("ul, ol")) return "list";
    if (b.matches(".table-wrap")) return "table";
    if (b.matches(".compare")) return "compare";
    if (b.matches(".divider")) return "divider";
    return "section";
  }

  // 見出し・文章などの呼び名
  function textLabel(e) {
    if (e.matches(".hero-label, .card-step")) return "ラベル";
    if (e.matches(".box-title")) return "ボックスのタイトル";
    if (e.matches(".compare-title")) return "比較のタイトル";
    if (e.matches(".item-text")) return "項目の文字";
    var names = {
      H1: "ページの見出し", H2: "大見出し", H3: "中見出し", P: "文章", LI: "リストの項目",
      SUMMARY: "質問", FIGCAPTION: "写真の説明", TH: "表の見出し", TD: "表のマス"
    };
    return names[e.tagName] || "文字";
  }

  // 1つ外側の、まとめて選べるもの（ボックス・カード・FAQ・写真・セクション）
  var GROUPS = ".photo, .box, li, .faq-item, ul:not(.card-grid), ol, .table-wrap, .compare, .section";
  var GROUP_NAMES = {
    photo: "写真", box: "ボックス", card: "カード", item: "項目", faq: "FAQの項目",
    list: "リスト", table: "表", compare: "比較", section: "セクション"
  };

  function parentBlock(b) {
    var p = b.parentElement;
    while (p && p !== mainEl) {
      if (p.matches(GROUPS)) return p;
      p = p.parentElement;
    }
    return null;
  }

  // カードは <li> を選び、見た目（色・高さ）は中の <a class="card"> に付ける
  function styleTarget(b) {
    return kindOf(b) === "card" ? b.querySelector(".card") : b;
  }

  // クリックした場所から、操作の対象を決める
  // 文字をクリック → その見出し・文章、文字以外の所 → ボックス・カード・写真・セクションなど
  function blockFrom(target) {
    // 写真・動画は、項目やボックスの中にあってもそれ自体を選ぶ
    var media = target.closest("main .photo");
    if (media) return media;
    var text = target.closest('[contenteditable="true"]');
    if (text && mainEl.contains(text)) return text;
    return target.closest("main .section .photo, main .section .box, main .section li, main .section .placeholder-media, main .faq-item, " +
      "main .section ul:not(.card-grid), main .section ol, main .section .table-wrap, main .section .compare, main .section .divider") ||
      target.closest("main .section");
  }

  function selectBlock(b) {
    if (selBlock === b) {
      positionBlockBar();
      return;
    }
    if (selBlock) selBlock.classList.remove("editor-selected");
    selBlock = b;
    blockBar.textContent = "";
    sizeSel = null;
    Object.keys(handles).forEach(function (dir) { handles[dir].hidden = true; });
    if (!b) {
      blockBar.hidden = true;
      return;
    }
    b.classList.add("editor-selected");

    var kind = kindOf(b);
    var labels = {
      section: "セクション", box: "テキストボックス", card: "カード", photo: "写真", placeholder: "画像の枠",
      faq: "FAQの項目", list: "リスト", table: "表", compare: "比較", divider: "区切り線"
    };
    if (kind === "photo" && b.querySelector("video, iframe")) labels.photo = "動画";
    var items = [el("span", "editor-blockbar-label", kind === "text" ? textLabel(b) : labels[kind])];

    // 外側のまとまり（ボックスやセクションなど）を選び直すボタン
    var parent = parentBlock(b);
    if (parent) {
      items.push(button(GROUP_NAMES[kindOf(parent)] + "を選ぶ", "editor-tool", function () { selectBlock(parent); },
        "外側の" + GROUP_NAMES[kindOf(parent)] + "ごと選ぶ（色・大きさ・削除など）"));
    }

    if (kind === "photo") {
      sizeSel = selectBox("写真の大きさ", "大きさ", PHOTO_SIZES, function (v) {
        setPhotoSize(b, v);
        b.style.width = "";
        afterResize();
      });
      items.push(sizeSel);
    }
    if (kind === "box") {
      var type = selectBox("ボックスの種類", "", BOX_TYPES, function (v) {
        b.classList.remove("box--warn", "box--plain");
        if (v) b.classList.add(v);
        dirty = true;
      });
      type.value = b.classList.contains("box--warn") ? "box--warn" : b.classList.contains("box--plain") ? "box--plain" : "";
      sizeSel = selectBox("ボックスの幅", "幅", BOX_WIDTHS, function (v) {
        b.style.width = v === "100" ? "" : v + "%";
        afterResize();
      });
      items.push(type, sizeSel);
    }
    // 何を選んでいても、その場所に写真・動画を入れるボタン
    if (kind !== "placeholder") {
      var where = ["box", "section", "card", "faq", "item"].indexOf(kind) !== -1 ||
        (b.closest("li") && !b.closest(".card-grid") && kind !== "photo") ? "の中の一番下" : "のすぐ下";
      items.push(
        button("＋写真", "editor-tool", function () { insertMediaInto(mediaSpot(b), "image/*"); },
          "ここ" + where + "に写真を入れる"),
        button("＋動画", "editor-tool", function () { insertMediaInto(mediaSpot(b), VIDEO_ACCEPT); },
          "ここ" + where + "に自分で撮った動画を入れる")
      );
    }
    if (kind === "card") {
      items.push(linkSelect(b.querySelector(".card")));
    }
    if (kind === "section" || kind === "box" || kind === "card") {
      items.push(colorPicker("背景色", "editor-tool", "背景の色", BLOCK_BGS, "元の背景色に戻す", function (v) {
        styleTarget(b).style.backgroundColor = v;
        dirty = true;
      }).wrap);
    }
    if (kind === "placeholder") {
      items.push(
        button("写真を入れる", "editor-tool", function () { replaceWithMedia(b, "image/*"); }),
        button("動画を入れる", "editor-tool", function () { replaceWithMedia(b, VIDEO_ACCEPT); }, "自分で撮った動画を入れる"),
        button("YouTube", "editor-tool", function () {
          var fig = youtubeFigure();
          if (!fig) return;
          b.replaceWith(fig);
          makeEditable(fig);
          dirty = true;
          selectBlock(fig);
        }, "YouTube の動画を埋め込む")
      );
    } else if (HANDLE_DIRS[kind]) {
      items.push(button("サイズを戻す", "editor-tool", function () { resetSize(b); }, "ドラッグで変えた大きさ・余白を元に戻す"));
    }
    if (kind === "list") {
      items.push(
        selectBox("リストの種類", "", LIST_TYPES, function (v) { changeListType(b, v); }),
        button("＋項目", "editor-tool", function () { addListItem(b); }, "最後に項目を追加する（項目の中で Enter でも追加できます）")
      );
      items[items.length - 2].value = listType(b);
    }
    if (kind === "table") {
      items.push(
        button("＋行", "editor-tool", function () { tableRow(b, 1); }, "選んでいるマスの下に行を追加"),
        button("＋列", "editor-tool", function () { tableCol(b, 1); }, "選んでいるマスの右に列を追加"),
        button("−行", "editor-tool", function () { tableRow(b, -1); }, "選んでいるマスの行を削除"),
        button("−列", "editor-tool", function () { tableCol(b, -1); }, "選んでいるマスの列を削除")
      );
    }
    if (["box", "card", "photo", "list", "table", "compare"].indexOf(kind) !== -1) {
      items.push(
        el("span", "editor-sep"),
        button("コピー", "editor-tool", function () { copyBlock(b); }, "コピーして、ほかの場所（ほかのページも可）に貼り付ける")
      );
    }
    // 質問・写真の説明・表のマスは、それだけ消すと形が崩れるので外側（FAQの項目・写真・表）ごと消してもらう
    var fixed = kind === "text" && b.matches("summary, figcaption, th, td");
    if (kind !== "section" && kind !== "placeholder" && !fixed) {
      items.push(button("複製", "editor-tool", function () { duplicateBlock(b); }, "すぐ後ろに同じものを作る"));
    }
    if (!fixed) {
      var horizontal = kind === "card";
      items.push(
        el("span", "editor-sep"),
        button(horizontal ? "◀" : "↑", "editor-tool", function () { moveBlock(b, -1); }, "前へ移動"),
        button(horizontal ? "▶" : "↓", "editor-tool", function () { moveBlock(b, 1); }, "後ろへ移動"),
        button("削除", "editor-tool editor-tool--danger", function () { deleteBlock(b); },
          kind === "section" ? "セクションを中身ごと削除する" : "削除する")
      );
    }
    blockBar.append.apply(blockBar, items);
    blockBar.hidden = false;
    syncSizeSelect();
    showHandles(kind);
    positionBlockBar();
  }

  /* ---------- リスト ---------- */
  function listType(list) {
    var found = LIST_TYPES.filter(function (t) { return list.classList.contains(t.value); })[0];
    return found ? found.value : list.tagName === "OL" ? "num-list" : "bullet-list";
  }

  // 種類を変える（箇条書き ⇔ 番号付き などはタグも ul / ol に変える）
  function changeListType(list, value) {
    var type = LIST_TYPES.filter(function (t) { return t.value === value; })[0];
    var next = el(type.tag);
    Array.from(list.attributes).forEach(function (a) { next.setAttribute(a.name, a.value); });
    LIST_TYPES.forEach(function (t) { next.classList.remove(t.value); });
    next.classList.add(type.value);
    while (list.firstChild) next.appendChild(list.firstChild);
    list.replaceWith(next);
    dirty = true;
    selBlock = null;
    selectBlock(next);
  }

  function addListItem(list, after) {
    var li = el("li", "", after ? "" : "新しい項目");
    if (after) after.after(li);
    else list.appendChild(li);
    makeEditable(li);
    dirty = true;
    selectText(li);
    positionBlockBar();
    return li;
  }

  /* ---------- 表 ---------- */
  // 操作の基準にするマス（カーソルのあるマス。なければ最後のマス）
  function currentCell(wrap) {
    var cell = currentHost && currentHost.isConnected && currentHost.closest("th, td");
    if (cell && wrap.contains(cell)) return cell;
    var cells = wrap.querySelectorAll("th, td");
    return cells[cells.length - 1];
  }

  function newCell(tag) {
    var c = el(tag);
    makeEditableCell(c);
    return c;
  }

  function makeEditableCell(c) {
    c.contentEditable = "true";
    c.spellcheck = false;
  }

  // dir = 1 で行を追加、-1 で行を削除
  function tableRow(wrap, dir) {
    var cell = currentCell(wrap);
    var row = cell.parentElement;
    var body = wrap.querySelector("tbody");
    if (dir > 0) {
      var tr = el("tr");
      Array.from(row.children).forEach(function () { tr.appendChild(newCell("td")); });
      // 見出しの行を選んでいるときは、本文の先頭に入れる
      if (row.parentElement === body) row.after(tr);
      else body.prepend(tr);
    } else {
      if (row.parentElement !== body || body.rows.length <= 1) {
        notify("見出しの行と、最後の1行は削除できません", true);
        return;
      }
      row.remove();
      currentHost = savedRange = null;
    }
    dirty = true;
    positionBlockBar();
  }

  // dir = 1 で列を追加、-1 で列を削除
  function tableCol(wrap, dir) {
    var index = currentCell(wrap).cellIndex;
    var rows = wrap.querySelectorAll("tr");
    if (dir < 0 && rows[0].cells.length <= 1) {
      notify("最後の1列は削除できません", true);
      return;
    }
    rows.forEach(function (tr) {
      var c = tr.cells[index];
      if (!c) return;
      if (dir > 0) c.after(newCell(c.tagName.toLowerCase()));
      else c.remove();
    });
    if (dir < 0) currentHost = savedRange = null;
    dirty = true;
    positionBlockBar();
  }

  // カードのリンク先（ヘッダーのメニューにあるページから選ぶ）
  function linkSelect(card) {
    var pages = Array.from(document.querySelectorAll(".global-nav a")).map(function (a) {
      return { value: a.getAttribute("href"), label: "リンク先：" + a.textContent.trim() };
    });
    var s = selectBox("カードのリンク先", "リンク先", pages, function (v) {
      card.setAttribute("href", v);
      dirty = true;
    });
    var href = card.getAttribute("href");
    s.value = pages.some(function (p) { return p.value === href; }) ? href : "__placeholder";
    return s;
  }

  function setPhotoSize(b, cls) {
    PHOTO_SIZES.forEach(function (o) { b.classList.remove(o.value); });
    b.classList.add(cls);
  }

  /* ---------- 大きさ・余白の変更（ドラッグ用のつまみ） ---------- */
  // 種類ごとに出すつまみ（e＝右端、s＝下端、se＝右下の角、n＝上端）
  var HANDLE_DIRS = {
    box: ["e", "s", "se"],
    card: ["e", "s", "se"],
    photo: ["e"],
    section: ["n", "s"]
  };

  function buildHandles() {
    var frag = document.createDocumentFragment();
    ["n", "e", "s", "se"].forEach(function (dir) {
      var h = el("div", "editor-resize editor-resize--" + dir);
      h.hidden = true;
      bindDrag(h, dir);
      handles[dir] = h;
      frag.appendChild(h);
    });
    sizeBadge = el("div", "editor-size-badge");
    sizeBadge.hidden = true;
    frag.appendChild(sizeBadge);
    return frag;
  }

  function showHandles(kind) {
    var titles = kind === "section"
      ? { n: "ドラッグで上の余白を変える", s: "ドラッグで下の余白（背景の境目）を動かす" }
      : { e: "ドラッグで幅を変える", s: "ドラッグで高さを変える", se: "ドラッグで幅と高さを変える" };
    (HANDLE_DIRS[kind] || []).forEach(function (dir) {
      handles[dir].hidden = false;
      handles[dir].title = titles[dir];
    });
  }

  function bindDrag(h, dir) {
    var start = null;
    h.addEventListener("pointerdown", function (e) {
      if (!selBlock) return;
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      start = dragStart(selBlock, e);
    });
    h.addEventListener("pointermove", function (e) {
      if (!start) return;
      var label = dragMove(start, dir, e);
      afterResize();
      sizeBadge.textContent = label;
      sizeBadge.hidden = false;
      sizeBadge.style.left = e.clientX + 16 + "px";
      sizeBadge.style.top = e.clientY + 16 + "px";
    });
    ["pointerup", "pointercancel"].forEach(function (type) {
      h.addEventListener(type, function () {
        start = null;
        sizeBadge.hidden = true;
      });
    });
  }

  function contentWidth(c) {
    var cs = getComputedStyle(c);
    return c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  function dragStart(b, e) {
    var cs = getComputedStyle(b);
    return {
      b: b,
      kind: kindOf(b),
      target: styleTarget(b),
      x: e.clientX,
      y: e.clientY,
      rect: styleTarget(b).getBoundingClientRect(),
      inner: contentWidth(b.parentElement),
      pt: parseFloat(cs.paddingTop),
      pb: parseFloat(cs.paddingBottom)
    };
  }

  // ドラッグ量に応じて大きさを変え、表示用の文字（例：幅 60%）を返す
  function dragMove(s, dir, e) {
    var dx = e.clientX - s.x, dy = e.clientY - s.y;
    var st = s.target.style;
    var label = [];
    var v;
    if (s.kind === "section") {
      if (dir === "n") {
        v = Math.max(0, Math.round(s.pt + dy));
        st.paddingTop = v + "px";
        return "上の余白 " + v + "px";
      }
      v = Math.max(0, Math.round(s.pb + dy));
      st.paddingBottom = v + "px";
      return "下の余白 " + v + "px";
    }
    if (dir.indexOf("e") !== -1) {
      if (s.kind === "card") {
        // カードは並び全体で幅をそろえる（幅に合わせて1行の枚数が変わる）
        v = clamp(Math.round(s.rect.width + dx), 120, s.inner);
        s.b.parentElement.style.setProperty("--card-min", v + "px");
        label.push("カードの幅 " + v + "px");
      } else if (s.kind === "photo") {
        // 写真は中央ぞろえなので、左右に同じだけ広がる
        v = clamp(Math.round((s.rect.width + dx * 2) / s.inner * 100), 10, 100);
        setPhotoSize(s.b, "photo--l");
        st.width = v >= 100 ? "" : v + "%";
        label.push("幅 " + v + "%");
      } else {
        v = clamp(Math.round((s.rect.width + dx) / s.inner * 100), 15, 100);
        st.width = v >= 100 ? "" : v + "%";
        label.push("幅 " + v + "%");
      }
    }
    if (dir.indexOf("s") !== -1) {
      v = Math.max(40, Math.round(s.rect.height + dy));
      st.minHeight = v + "px";
      label.push("高さ " + v + "px");
    }
    return label.join(" / ");
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function resetSize(b) {
    var kind = kindOf(b);
    if (kind === "section") {
      b.style.paddingTop = b.style.paddingBottom = "";
    } else if (kind === "card") {
      b.querySelector(".card").style.minHeight = "";
      b.parentElement.style.removeProperty("--card-min");
    } else {
      b.style.width = b.style.minHeight = "";
      if (kind === "photo") setPhotoSize(b, "photo--m");
    }
    afterResize();
  }

  function afterResize() {
    dirty = true;
    syncSizeSelect();
    positionBlockBar();
  }

  // 選択肢にない大きさ（ドラッグで決めたもの）は「幅 ○○%」と表示する
  function syncSizeSelect() {
    if (!sizeSel || !selBlock) return;
    var b = selBlock;
    var pct = Math.round(parseFloat(b.style.width)) || 0;
    var value;
    if (kindOf(b) === "box") {
      value = String(pct || 100);
      if (!BOX_WIDTHS.some(function (o) { return o.value === value; })) value = null;
      sizeSel.options[0].textContent = value ? "幅" : "幅 " + pct + "%";
    } else {
      value = pct ? null : (PHOTO_SIZES.filter(function (o) { return b.classList.contains(o.value); })[0] || PHOTO_SIZES[1]).value;
      sizeSel.options[0].textContent = value ? "大きさ" : "幅 " + pct + "%";
    }
    sizeSel.value = value || "__placeholder";
  }

  /* ---------- コピー・貼り付け・複製 ---------- */
  function copyBlock(b) {
    if (b.querySelector('[src^="blob:"]')) {
      notify("この写真は、一度「保存」してからコピーしてください", true);
      return;
    }
    clipHtml = cleanNode(b.cloneNode(true)).outerHTML;
    try { localStorage.setItem(CLIP_KEY, clipHtml); } catch (e) {}
    notify("コピーしました。貼り付けたい場所をクリックして「＋挿入」→「貼り付け」");
  }

  function getClip() {
    try {
      return localStorage.getItem(CLIP_KEY) || clipHtml;
    } catch (e) {
      return clipHtml;
    }
  }

  function pasteBlock() {
    var html = getClip();
    if (!html) {
      notify("先に、テキストボックス・カード・写真のどれかを「コピー」してください", true);
      return;
    }
    var t = el("template");
    t.innerHTML = html;
    var node = t.content.firstElementChild;
    if (node && insertBlock(node)) selectBlock(node);
  }

  function duplicateBlock(b) {
    var copy = b.cloneNode(true);
    copy.classList.remove("editor-selected");
    b.after(copy);
    dirty = true;
    selectBlock(copy);
    copy.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function moveBlock(b, dir) {
    var sib = dir < 0 ? b.previousElementSibling : b.nextElementSibling;
    if (!sib) return;
    if (dir < 0) sib.before(b);
    else sib.after(b);
    dirty = true;
    b.scrollIntoView({ block: "nearest", behavior: "smooth" });
    positionBlockBar();
  }

  function deleteBlock(b) {
    var next = parentBlock(b);
    if (currentHost && b.contains(currentHost)) {
      currentHost = savedRange = null;
      hideToolbar();
    }
    var parent = b.parentElement;
    b.remove();
    // カード・リストの項目を全部消したら、空になった並びも消す
    if (parent.matches("ul, ol") && !parent.children.length) parent.remove();
    dirty = true;
    selectBlock(next && next.isConnected ? next : null);
    notify("削除しました（保存前なら「終了」で元に戻せます）");
  }

  function positionBlockBar() {
    if (blockBar.hidden || !selBlock) return;
    var r = selBlock.getBoundingClientRect();
    var header = document.querySelector(".site-header");
    var minTop = (header ? header.getBoundingClientRect().bottom : 0) + 8;
    var h = blockBar.offsetHeight, w = blockBar.offsetWidth;
    var top, left;
    if (selBlock.matches(".section")) {
      // セクションは右上の内側に表示（長いセクションでは画面上部に付いてくる）
      top = Math.min(Math.max(r.top + 8, minTop), r.bottom - h - 8);
      left = r.right - w - 12;
    } else {
      top = r.top - h - 8;
      if (top < minTop) top = Math.max(r.top + 8, minTop);
      left = r.left;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    var offscreen = r.bottom < minTop || r.top > window.innerHeight;
    blockBar.style.top = top + "px";
    blockBar.style.left = left + "px";
    blockBar.style.visibility = offscreen ? "hidden" : "";

    // つまみはカードなら中の <a class="card"> の端に付ける
    var t = styleTarget(selBlock).getBoundingClientRect();
    placeHandle(handles.n, t.left + t.width / 2, t.top, minTop);
    placeHandle(handles.e, t.right, t.top + t.height / 2, minTop);
    placeHandle(handles.s, t.left + t.width / 2, t.bottom, minTop);
    placeHandle(handles.se, t.right, t.bottom, minTop);
  }

  function placeHandle(h, x, y, minTop) {
    if (h.hidden) return;
    h.style.left = x - h.offsetWidth / 2 + "px";
    h.style.top = y - h.offsetHeight / 2 + "px";
    h.style.visibility = y < minTop || y > window.innerHeight ? "hidden" : "";
  }

  /* ---------- デザイン設定パネル ---------- */
  function buildPanel() {
    panel = el("div", "editor-panel");
    panel.setAttribute("role", "dialog");
    panel.ariaLabel = "デザイン設定";
    panel.hidden = true;

    panel.append(
      el("p", "editor-panel-title", "デザイン設定"),
      el("p", "editor-panel-note", "すべてのページに反映されます。「保存」で確定します。"),
      colorField("メインカラー", "primary", THEME_COLORS),
      colorField("背景色", "bg", BG_COLORS),
      fontField("見出しのフォント", "heading"),
      fontField("本文のフォント", "body"),
      button("最初のデザインに戻す", "editor-panel-reset", function () {
        setDesign(Object.assign({}, DEFAULT_DESIGN));
      })
    );
    return panel;
  }

  function colorField(label, key, colors) {
    var f = el("fieldset", "editor-field");
    f.appendChild(el("legend", "", label));
    var row = el("div", "editor-field-row");
    var swatches = colors.map(function (c) {
      var s = swatch(c.value, c.label, function () { changeColor(key, c.value); });
      s.dataset.value = c.value;
      row.appendChild(s);
      return s;
    });
    var input = el("input");
    input.type = "color";
    input.title = input.ariaLabel = label + "を自由に選ぶ";
    input.addEventListener("input", function () { changeColor(key, input.value); });
    row.appendChild(input);
    f.appendChild(row);
    panelInputs[key] = { input: input, swatches: swatches };
    return f;
  }

  function fontField(label, key) {
    var f = el("div", "editor-field");
    var s = selectBox(label, "", FONTS.map(function (o) {
      return { value: o.value, label: o.label, font: o.value };
    }), function (v) {
      var d = Object.assign({}, design);
      d[key] = v;
      setDesign(d);
    });
    s.id = "editor-font-" + key;
    var l = el("label", "", label);
    l.htmlFor = s.id;
    f.append(l, s);
    panelInputs[key] = { select: s };
    return f;
  }

  function togglePanel() {
    if (panel.hidden) {
      if (!design) design = readDesign();
      refreshPanel();
    }
    panel.hidden = !panel.hidden;
    designBtn.setAttribute("aria-expanded", String(!panel.hidden));
  }

  // いま style.css に書かれている設定を読み取る
  function readDesign() {
    var cs = getComputedStyle(document.documentElement);
    function v(name) { return cs.getPropertyValue(name).trim(); }
    return {
      primary: v("--c-primary").toLowerCase(),
      dark: v("--c-primary-dark").toLowerCase(),
      accent: v("--c-accent").toLowerCase(),
      bg: v("--c-bg").toLowerCase(),
      heading: matchFont(v("--font-heading")),
      body: matchFont(v("--font-body"))
    };
  }

  function matchFont(value) {
    var found = FONTS.filter(function (f) {
      return f.name && value.indexOf(f.name) !== -1;
    })[0];
    return found ? found.value : SYSTEM_FONT;
  }

  function changeColor(key, value) {
    var d = Object.assign({}, design);
    d[key] = value;
    if (key === "primary") {
      // 濃い色（ヘッダー等）とアクセント色（グラデーション）はメインカラーから作る
      if (value === DEFAULT_DESIGN.primary) {
        d.dark = DEFAULT_DESIGN.dark;
        d.accent = DEFAULT_DESIGN.accent;
      } else {
        var hsl = hexToHsl(value);
        d.dark = hslToHex(hsl[0], hsl[1], Math.max(hsl[2] - 16, 10));
        d.accent = hslToHex((hsl[0] + 332) % 360, hsl[1], Math.min(Math.max(hsl[2] - 8, 25), 60));
      }
    }
    setDesign(d);
  }

  function setDesign(d) {
    design = d;
    var s = document.documentElement.style;
    s.setProperty("--c-primary", d.primary);
    s.setProperty("--c-primary-dark", d.dark);
    s.setProperty("--c-accent", d.accent);
    s.setProperty("--c-bg", d.bg);
    s.setProperty("--font-heading", d.heading);
    s.setProperty("--font-body", d.body);
    designDirty = true;
    refreshPanel();
  }

  function refreshPanel() {
    ["primary", "bg"].forEach(function (key) {
      var p = panelInputs[key];
      p.input.value = design[key];
      p.swatches.forEach(function (s) {
        s.classList.toggle("is-active", s.dataset.value === design[key]);
      });
    });
    panelInputs.heading.select.value = design.heading;
    panelInputs.body.select.value = design.body;
  }

  function designCss(d) {
    return [
      "/* ===== デザイン設定（編集モードの「デザイン」パネルが自動で書き換えます） ===== */",
      ":root {",
      "  --c-primary: " + d.primary + ";",
      "  --c-primary-dark: " + d.dark + ";",
      "  --c-accent: " + d.accent + ";",
      "  --c-bg: " + d.bg + ";",
      "  --font-heading: " + d.heading + ";",
      "  --font-body: " + d.body + ";",
      "}",
      "/* ===== デザイン設定ここまで ===== */"
    ].join("\n");
  }

  function hexToHsl(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }

  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    function f(n) {
      var k = (n + h / 30) % 12;
      var c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return ("0" + Math.round(c * 255).toString(16)).slice(-2);
    }
    return "#" + f(0) + f(8) + f(4);
  }

  /* ---------- 編集モードの切り替え ---------- */
  function startEdit() {
    editing = true;
    document.body.classList.add("is-editing");
    makeEditable(mainEl);
    // 太字などは <b> タグで入れる
    document.execCommand("styleWithCSS", false, false);
    // 折りたたみ（FAQ）は全部開いておく（保存するときは元の状態に戻す）
    document.querySelectorAll("main details:not([open])").forEach(function (d) {
      d.dataset.editorClosed = "";
      d.open = true;
    });
    setEditButtons(true);
    notify("編集モード：文字をクリックして書き換え。セクションや写真をクリックすると操作バーが出ます");
  }

  function exitEdit() {
    var changed = dirty || designDirty;
    if (changed && !confirm("保存していない変更があります。破棄して終了しますか？")) return;
    if (changed) {
      dirty = designDirty = false;
      location.reload();
      return;
    }
    editing = false;
    document.body.classList.remove("is-editing");
    document.querySelectorAll("[contenteditable]").forEach(function (e) {
      e.removeAttribute("contenteditable");
      e.removeAttribute("spellcheck");
    });
    hideToolbar();
    selectBlock(null);
    closeInsertMenu();
    panel.hidden = true;
    designBtn.setAttribute("aria-expanded", "false");
    setEditButtons(false);
  }

  /* ---------- 編集中の操作 ---------- */
  function bindEditEvents() {
    var editorUI = ".editor-bar, .editor-toolbar, .editor-panel, .editor-resize";

    // リンク移動・FAQの開閉を止める
    document.addEventListener("click", function (e) {
      if (!editing) return;
      if (e.target.closest(editorUI)) return;
      if (e.target.closest("main a, main summary")) e.preventDefault();
    }, true);

    document.addEventListener("mousedown", function (e) {
      // 色のパレット・挿入メニューは外をクリックしたら閉じる
      document.querySelectorAll(".editor-colors").forEach(function (box) {
        if (!box.parentElement.contains(e.target)) box.hidden = true;
      });
      if (!e.target.closest(".editor-insert")) closeInsertMenu();
      // クリックしたセクション・ボックス・写真を選ぶ
      if (!editing || e.target.closest(editorUI)) return;
      selectBlock(blockFrom(e.target));
    });

    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", positionBars, { passive: true });
    window.addEventListener("resize", positionBars);

    document.addEventListener("keydown", function (e) {
      if (!editing) return;
      // Ctrl+S で保存（デザインパネルを操作中でも）
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
        return;
      }
      // 文字の入力中でなければ、Delete / BackSpace で選択中のボックス・カード・写真を削除
      if (!e.target.isContentEditable) {
        var formField = e.target.closest && e.target.closest("input, select, textarea");
        if ((e.key === "Delete" || e.key === "Backspace") && !formField &&
            selBlock && !selBlock.matches(".section")) {
          e.preventDefault();
          deleteBlock(selBlock);
        }
        return;
      }
      // リストの項目では Enter で次の項目を追加、空の項目で BackSpace を押すと項目を削除
      // （写真を入れた項目では、文字の部分 <p class="item-text"> で押したときも同じ）
      var li = e.target.matches("li") ? e.target : e.target.matches("li > .item-text") ? e.target.parentElement : null;
      if (li && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        selectBlock(addListItem(li.parentElement, li));
        return;
      }
      if (li && e.key === "Backspace" && !li.textContent && !li.querySelector("img, video, iframe") &&
          li.parentElement.children.length > 1) {
        e.preventDefault();
        var prevItem = li.previousElementSibling || li.nextElementSibling;
        var prevText = prevItem.matches('[contenteditable="true"]') ? prevItem : prevItem.querySelector('[contenteditable="true"]');
        li.remove();
        dirty = true;
        selectBlock(prevText || prevItem);
        if (prevText) {
          selectText(prevText);
          getSelection().collapseToEnd();
        }
        return;
      }
      // Enter で段落が分裂しないようにする（Shift+Enter は改行）
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) document.execCommand("insertLineBreak");
      }
      // summary 内のスペースで開閉しないようにする
      if (e.key === " " && e.target.closest("summary")) {
        e.preventDefault();
        document.execCommand("insertText", false, " ");
      }
    });

    document.addEventListener("keyup", function (e) {
      if (editing && e.key === " " && e.target.closest && e.target.closest("summary")) {
        e.preventDefault();
      }
    });

    // 貼り付けは書式なしテキストのみ
    // 写真・動画のファイルをページにドラッグ＆ドロップすると、その場所に入れる
    // （編集中は、ファイルを落としたときにブラウザがそのファイルを開いてしまわないようにする）
    document.addEventListener("dragover", function (e) {
      if (editing && e.dataTransfer && Array.from(e.dataTransfer.types).indexOf("Files") !== -1) {
        e.preventDefault();
        e.dataTransfer.dropEffect = e.target.closest("main .section") ? "copy" : "none";
      }
    });
    document.addEventListener("drop", function (e) {
      if (!editing || !e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var target = blockFrom(e.target);
      if (!target) {
        notify("写真・動画は、ページの本文（セクションの中）にドロップしてください", true);
        return;
      }
      currentHost = savedRange = null;
      hideToolbar();
      selectBlock(target);
      insertFiles(Array.from(e.dataTransfer.files));
    });

    document.addEventListener("paste", function (e) {
      if (!editing || !e.target.isContentEditable) return;
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, text.replace(/\r?\n/g, " "));
    });

    document.addEventListener("input", function (e) {
      if (editing && e.target.isContentEditable) {
        dirty = true;
        positionBlockBar();
      }
    });

    window.addEventListener("beforeunload", function (e) {
      if (dirty || designDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  // 操作バーの位置を先に決めてから、重ならないように書式ツールバーを置く
  function positionBars() {
    positionBlockBar();
    positionToolbar();
  }

  /* ---------- フォルダの記憶（IndexedDB） ---------- */
  function idb(mode, fn) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onerror = function () { reject(req.error); };
      req.onsuccess = function () {
        var tx = req.result.transaction(STORE, mode);
        var r = fn(tx.objectStore(STORE));
        tx.oncomplete = function () { resolve(r && r.result); };
        tx.onerror = function () { reject(tx.error); };
      };
    });
  }

  function loadDir() {
    return idb("readonly", function (s) { return s.get(KEY); }).catch(function () { return null; });
  }

  function storeDir(handle) {
    return idb("readwrite", function (s) { s.put(handle, KEY); }).catch(function () {});
  }

  async function getSiteDir() {
    var dir = await loadDir();
    if (dir) {
      var opts = { mode: "readwrite" };
      if ((await dir.queryPermission(opts)) === "granted" ||
          (await dir.requestPermission(opts)) === "granted") {
        if (await hasFile(dir)) return dir;
      }
    }
    notify("サイトのフォルダ（HTMLファイルが入っているフォルダ）を選んでください");
    dir = await window.showDirectoryPicker({ id: "bakuten-site", mode: "readwrite" });
    if (!(await hasFile(dir))) {
      throw new Error("選んだフォルダに " + fileName() + " が見つかりません。サイトのフォルダを選んでください。");
    }
    await storeDir(dir);
    return dir;
  }

  async function hasFile(dir) {
    try {
      await dir.getFileHandle(fileName());
      return true;
    } catch (e) {
      return false;
    }
  }

  async function writeFile(handle, data) {
    var w = await handle.createWritable();
    await w.write(data);
    await w.close();
  }

  /* ---------- 保存 ---------- */
  async function save() {
    if (!("showDirectoryPicker" in window)) {
      notify("このブラウザは保存に対応していません。Chrome で開いてください。", true);
      return;
    }
    saveBtn.disabled = true;
    try {
      var dir = await getSiteDir();
      var handle = await dir.getFileHandle(fileName());
      var original = await (await handle.getFile()).text();

      // ディスク上の元ファイルを読み込み、本文（<main>）だけを差し替える
      var doc = new DOMParser().parseFromString(original, "text/html");
      var dstMain = doc.querySelector("main");
      if (!dstMain || dstMain.innerHTML !== loadedMain) {
        throw new Error("ファイルが別の場所で書き換えられています。ページを再読み込みしてから編集してください。");
      }

      // 新しく入れた写真・動画を images・videos フォルダに書き出す
      // （複製したものは同じファイルを使う）
      var saved = [fileName()];
      var media = mainEl.querySelectorAll('img[src^="blob:"], video[src^="blob:"]');
      var written = {};
      for (var i = 0; i < media.length; i++) {
        var url = media[i].getAttribute("src");
        var file = pendingImages[url];
        if (!written[url]) {
          if (!file) continue;
          var sub = await dir.getDirectoryHandle(file.dir, { create: true });
          await writeFile(await sub.getFileHandle(file.name, { create: true }), file.blob);
          written[url] = file.dir + "/" + file.name;
        }
        media[i].setAttribute("src", written[url]);
      }
      Object.keys(written).forEach(function (url) {
        delete pendingImages[url];
        URL.revokeObjectURL(url);
      });
      if (Object.keys(written).length) saved.push("写真・動画" + Object.keys(written).length + "件");

      // トップページならカードの並びからステップを決める（カードの番号・リンク先もここで直す）
      var steps = fileName() === "index.html" ? await prepareSteps(dir) : null;

      dstMain.innerHTML = cleanMain();
      if (steps) applyNav(doc, steps, fileName());
      var html = serialize(doc);
      await writeFile(handle, html);
      loadedMain = new DOMParser().parseFromString(html, "text/html").querySelector("main").innerHTML;

      // ステップのページとメニューを全ページで連動させる
      if (steps) {
        var count = await syncStepPages(dir, steps);
        applyNav(document, steps, fileName());
        if (count) saved.push("ほかのページ" + count + "件（ステップのメニュー連動）");
      }

      // デザイン設定は style.css の該当部分だけ書き換える（全ページに反映）
      if (designDirty) {
        var cssHandle = await dir.getFileHandle("style.css");
        var css = await (await cssHandle.getFile()).text();
        if (!DESIGN_RE.test(css)) {
          throw new Error("style.css の「デザイン設定」の場所が見つかりません。");
        }
        await writeFile(cssHandle, css.replace(DESIGN_RE, designCss(design)));
        saved.push("style.css（デザイン）");
      }

      dirty = designDirty = false;
      notify("保存しました：" + saved.join("、"));
    } catch (e) {
      if (e.name !== "AbortError") notify("保存できませんでした：" + e.message, true);
    } finally {
      saveBtn.disabled = false;
    }
  }

  function serialize(doc) {
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML + "\n";
  }

  /* ---------- ステップの連動（トップページのカードが元） ----------
     - カードの並び順が STEP 1, 2, 3… になり、ページは step1.html, step2.html… に対応
     - カードを複製・並べ替えたときは、元のページの中身をコピー・移動して作り直す
     - ヘッダー・フッターのメニュー、各ステップの見出し・前後リンクも合わせて更新 */
  var STEP_RE = /^step\d+\.html$/;

  function stepCards() {
    return Array.from(mainEl.querySelectorAll(".card-grid .card")).filter(function (a) {
      return STEP_RE.test(a.getAttribute("href") || "");
    });
  }

  async function readText(dir, name) {
    try {
      return await (await (await dir.getFileHandle(name)).getFile()).text();
    } catch (e) {
      return null;
    }
  }

  // カードから各ステップの情報を作り、元になるページの中身を先に読み込んでおく
  async function prepareSteps(dir) {
    var cards = stepCards();
    if (!cards.length) return null;
    var sources = {};
    for (var i = 0; i < cards.length; i++) {
      var href = cards[i].getAttribute("href");
      if (!(href in sources)) sources[href] = await readText(dir, href);
    }
    var template = cards.map(function (a) { return sources[a.getAttribute("href")]; }).filter(Boolean)[0];
    if (!template) throw new Error("ステップのページ（step1.html など）が見つかりません。");

    return cards.map(function (a, i) {
      var num = i + 1;
      // 「STEP 5」のような番号ラベルは並び順に振り直す（それ以外の文字はそのまま）
      var label = a.querySelector(".card-step");
      if (label && /^STEP\s*\d+$/i.test(label.textContent.trim())) label.textContent = "STEP " + num;
      var source = sources[a.getAttribute("href")] || template;
      var h3 = a.querySelector("h3");
      var cardTitle = h3 ? h3.textContent.trim() : "";
      var pageH1 = new DOMParser().parseFromString(source, "text/html").querySelector("main h1");
      var step = {
        num: num,
        href: "step" + num + ".html",
        source: source,
        label: label ? label.textContent.trim() : "STEP " + num,
        cardTitle: cardTitle,
        // カードの見出しが空なら、ページの見出しを使う
        title: cardTitle || (pageH1 ? pageH1.textContent.trim() : "")
      };
      a.setAttribute("href", step.href);
      return step;
    });
  }

  function compactLabel(s) {
    return s.label.replace(/\s+/g, "");
  }

  function navText(s) {
    return compactLabel(s) + (s.title ? " " + s.title : "");
  }

  // ステップのページを並び順どおりに書き出し、ほかのページのメニューも更新する
  async function syncStepPages(dir, steps) {
    var count = 0;
    for (var i = 0; i < steps.length; i++) {
      var doc = new DOMParser().parseFromString(steps[i].source, "text/html");
      applyStepPage(doc, steps, i);
      applyNav(doc, steps, steps[i].href);
      if (await writeIfChanged(dir, steps[i].href, serialize(doc))) count++;
    }
    // トップとステップ以外のページ（はじめに・FAQ・使わなくなったステップなど）
    var names = [];
    for await (var entry of dir.values()) {
      if (entry.kind === "file" && /\.html$/.test(entry.name)) names.push(entry.name);
    }
    var stepHrefs = steps.map(function (s) { return s.href; });
    for (var j = 0; j < names.length; j++) {
      var name = names[j];
      if (name === fileName() || stepHrefs.indexOf(name) !== -1) continue;
      var text = await readText(dir, name);
      if (!text) continue;
      var other = new DOMParser().parseFromString(text, "text/html");
      applyNav(other, steps, name);
      if (await writeIfChanged(dir, name, serialize(other))) count++;
    }
    return count;
  }

  async function writeIfChanged(dir, name, html) {
    var old = await readText(dir, name);
    // 改行などの書き方の違いだけなら書き換えない
    if (old !== null && serialize(new DOMParser().parseFromString(old, "text/html")) === html) return false;
    await writeFile(await dir.getFileHandle(name, { create: true }), html);
    return true;
  }

  // ステップのページの番号・見出し・タイトル・前後リンク
  function applyStepPage(doc, steps, i) {
    var s = steps[i];
    var label = doc.querySelector("main .hero-label");
    if (label) label.textContent = s.label;
    var h1 = doc.querySelector("main h1");
    if (h1 && s.cardTitle && h1.textContent.trim() !== s.cardTitle) h1.textContent = s.cardTitle;
    var site = doc.title.split("｜").pop();
    doc.title = navText(s) + "｜" + site;
    var desc = doc.querySelector('meta[name="description"]');
    if (desc && /^バク転練習ステップ/.test(desc.getAttribute("content") || "")) {
      desc.setAttribute("content", "バク転練習ステップ" + s.num + "「" + s.title + "」の解説です。");
    }
    var last = steps.length - 1;
    setStepLink(doc.querySelector(".step-nav .prev"), i === 0
      ? { href: "intro.html", small: "← 前へ", text: "はじめに・安全について" }
      : { href: steps[i - 1].href, small: "← 前のステップ", text: navText(steps[i - 1]) });
    setStepLink(doc.querySelector(".step-nav .next"), i === last
      ? { href: "faq.html", small: "次へ →", text: "よくある質問" }
      : { href: steps[i + 1].href, small: "次のステップ →", text: navText(steps[i + 1]) });
  }

  function setStepLink(a, link) {
    if (!a) return;
    a.setAttribute("href", link.href);
    a.textContent = "";
    var small = a.ownerDocument.createElement("small");
    small.textContent = link.small;
    a.append(small, link.text);
  }

  // ヘッダー・フッターのメニューのステップ部分を作り直す
  function applyNav(doc, steps, current) {
    replaceStepItems(doc.querySelector(".global-nav ul"), steps.map(function (s) {
      return { href: s.href, text: compactLabel(s) };
    }), current);
    replaceStepItems(doc.querySelector(".footer-nav ul"), steps.map(function (s) {
      return { href: s.href, text: navText(s) };
    }), null);
    // ステップ以外のページの前後リンク（はじめに → 最初のステップ、FAQ ← 最後のステップ）
    if (STEP_RE.test(current)) return;
    doc.querySelectorAll(".step-nav a").forEach(function (a) {
      if (!STEP_RE.test(a.getAttribute("href") || "")) return;
      var s = a.classList.contains("prev") ? steps[steps.length - 1] : steps[0];
      var small = a.querySelector("small");
      setStepLink(a, { href: s.href, small: small ? small.textContent : "", text: navText(s) });
    });
  }

  function replaceStepItems(ul, items, current) {
    if (!ul) return;
    var lis = Array.from(ul.children).filter(function (li) {
      var a = li.querySelector("a");
      return a && STEP_RE.test(a.getAttribute("href") || "");
    });
    if (!lis.length) return;
    // 元の字下げをそのまま使う
    var prev = lis[0].previousSibling;
    var indent = prev && prev.nodeType === 3 ? prev.textContent : "\n";
    var after = lis[lis.length - 1].nextSibling;
    lis.forEach(function (li) {
      var ws = li.previousSibling;
      if (ws && ws.nodeType === 3) ws.remove();
      li.remove();
    });
    var doc = ul.ownerDocument;
    items.forEach(function (item) {
      var li = doc.createElement("li");
      var a = doc.createElement("a");
      a.setAttribute("href", item.href);
      a.textContent = item.text;
      if (item.href === current) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      ul.insertBefore(doc.createTextNode(indent), after);
      ul.insertBefore(li, after);
    });
  }

  // 編集用の目印を取り除いた本文の HTML
  function cleanMain() {
    return cleanNode(mainEl.cloneNode(true)).innerHTML;
  }

  // 複製した要素から、編集用の目印を取り除く
  function cleanNode(clone) {
    // clone 自身も対象にする（コピーしたテキストボックスなど）
    function each(selector, fn) {
      [clone].concat(Array.from(clone.querySelectorAll("*"))).forEach(function (e) {
        if (e.matches(selector)) fn(e);
      });
    }
    each("[contenteditable]", function (e) {
      e.innerHTML = clean(e.innerHTML);
      e.removeAttribute("contenteditable");
      e.removeAttribute("spellcheck");
    });
    each("[data-editor-closed]", function (d) {
      d.removeAttribute("open");
      d.removeAttribute("data-editor-closed");
    });
    each(".editor-selected", function (e) { e.classList.remove("editor-selected"); });
    each('[class=""]', function (e) { e.removeAttribute("class"); });
    each('[style=""]', function (e) { e.removeAttribute("style"); });
    // 写真の説明文を代替テキスト（読み上げ用）にも使う
    each(".photo img", function (img) {
      var cap = img.parentElement.querySelector("figcaption");
      img.alt = cap ? cap.textContent.trim() : "";
    });
    return clone;
  }

  // 編集で紛れ込みやすいゴミを取り除く
  function clean(html) {
    return html
      .replace(/&nbsp;/g, " ")
      .replace(/<br\s*\/?>\s*$/i, "")
      .trim();
  }

  buildUI();
  bindEditEvents();
})();
