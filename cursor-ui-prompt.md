# SEO Scripts v2 — UI Refactor Prompt for Cursor AI
> Project: Electron app, src/renderer/ — HTML + CSS + JS  
> Design system: Material Design 3, dark theme, `#0d1117` background  
> Per-tab accent colours already defined in `styles.css` via `body[data-tab]` → `--tab-accent`

---

## CONTEXT

The app has 5 tabs. Tabs 3–5 (SEO Parser, Image Downloader, Keyword Clusterer) are already built correctly.  
**Tabs 1–2 (Redirect Builder, Image Optimizer) are broken** — they lost their 3-column layout and look outdated.  
Your job is to make ALL tabs look identical in structure quality and MD3 polish.

**3-column layout rule (apply to EVERY tab):**
```
┌─────────────────────────────────────────────────────────┐
│  TITLEBAR  [tab1] [tab2] [tab3] [tab4] [tab5]  [─][□][✕]│
├──────────────┬──────────────────────────┬───────────────┤
│  LEFT SIDEBAR│      CENTER (main)       │  RIGHT SIDEBAR│
│  280px fixed │      flex: 1             │  280px fixed  │
│  Controls /  │  Table / Drop zone /     │  Settings /   │
│  File list / │  Results / Preview /     │  Preview /    │
│  URL inputs  │  Log / Cards             │  Output/Info  │
└──────────────┴──────────────────────────┴───────────────┘
```

---

## TASK 1 — Redirect Builder: restore 3-column layout

**File:** `src/renderer/index.html` — `#panel-redirect`  
**File:** `src/renderer/redirect-app.js`

Current problem: left sidebar lost structure, center and right panels are misaligned.

Rebuild `#panel-redirect` inner layout:

```html
<div class="tool-layout">

  <!-- LEFT: redirect list + actions -->
  <aside class="tool-sidebar tool-sidebar--left">
    <div class="sidebar-header">
      <span class="material-symbols-outlined sidebar-header__icon">swap_horiz</span>
      <span class="sidebar-header__title">Редиректы</span>
      <span class="chip chip--accent" id="redirect-count">0</span>
    </div>
    <div class="sidebar-body" style="gap:8px; padding:10px">
      <button class="md-btn md-btn--filled md-btn--block" id="add-redirect-btn">
        <span class="material-symbols-outlined">add</span> Добавить
      </button>
      <button class="md-btn md-btn--outlined md-btn--block" id="import-excel-btn">
        <span class="material-symbols-outlined">upload_file</span> Импорт Excel
      </button>
      <button class="md-btn md-btn--outlined md-btn--block" id="clear-all-btn">
        <span class="material-symbols-outlined">delete_sweep</span> Очистить
      </button>
    </div>
  </aside>

  <!-- CENTER: mode tabs + table + generated rules -->
  <section class="tool-main" style="display:flex; flex-direction:column;">
    <!-- mode switcher -->
    <div class="mode-tabs" id="redirect-mode-tabs">
      <button class="mode-tab active" data-mode="edit">
        <span class="material-symbols-outlined" style="font-size:15px">edit</span> Редактирование
      </button>
      <button class="mode-tab" data-mode="paste">
        <span class="material-symbols-outlined" style="font-size:15px">content_paste</span> Массовая вставка
      </button>
    </div>

    <!-- edit mode -->
    <div class="mode-content active table-wrap" id="edit-mode" style="flex:1; overflow:auto;">
      <table class="data-table" id="redirects-table">
        <thead>
          <tr>
            <th style="width:4%"><input type="checkbox" id="select-all-checkbox"></th>
            <th style="width:44%">Старый URL <small style="opacity:.5; font-weight:400">обрезается до пути</small></th>
            <th style="width:44%">Новый URL <small style="opacity:.5; font-weight:400">с https://</small></th>
            <th style="width:8%"></th>
          </tr>
        </thead>
        <tbody id="redirects-tbody"></tbody>
      </table>
    </div>

    <!-- paste mode -->
    <div class="mode-content table-wrap" id="paste-mode" style="display:none; flex:1; overflow:auto;">
      <div style="padding:10px 14px; display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--md-sys-color-on-surface-variant); border-bottom:1px solid var(--md-sys-color-outline-variant);">
        <span class="material-symbols-outlined" style="font-size:16px; color:var(--tab-accent)">info</span>
        Вставьте (Ctrl+V): Старый URL [Tab] Новый URL, по одной строке
      </div>
      <table class="data-table" id="paste-table">
        <thead><tr><th>Старый URL</th><th>Новый URL</th></tr></thead>
        <tbody id="paste-tbody"></tbody>
      </table>
      <div style="padding:10px; display:flex; gap:8px; border-top:1px solid var(--md-sys-color-outline-variant);">
        <button class="md-btn md-btn--filled" id="apply-paste-btn">
          <span class="material-symbols-outlined">check</span> Применить (<span id="paste-count">0</span>)
        </button>
        <button class="md-btn md-btn--outlined" id="clear-paste-btn">
          <span class="material-symbols-outlined">delete</span> Очистить
        </button>
      </div>
    </div>

    <!-- generated rules output -->
    <div style="flex-shrink:0; border-top:1px solid var(--md-sys-color-outline-variant);">
      <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--md-sys-color-surface-container-low);">
        <span style="font-size:12px; font-weight:600; color:var(--md-sys-color-on-surface-variant); text-transform:uppercase; letter-spacing:.5px; flex:1;">Сгенерированные правила</span>
        <button class="md-btn md-btn--tonal md-btn--sm" id="copy-results-btn">
          <span class="material-symbols-outlined">content_copy</span> Копировать
        </button>
        <button class="md-btn md-btn--outlined md-btn--sm" id="clear-results-btn">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
      <textarea id="results-textarea" readonly
        style="width:100%; height:120px; resize:none; padding:10px 14px; background:var(--md-sys-color-surface-container-lowest); border:none; outline:none; font-family:'Roboto Mono',monospace; font-size:12px; line-height:1.6; color:var(--md-sys-color-on-surface); user-select:text;"
        placeholder="Нажмите «Сгенерировать» чтобы получить правила…"></textarea>
    </div>
  </section>

  <!-- RIGHT: format settings + live checker -->
  <aside class="tool-sidebar tool-sidebar--right">
    <div class="sidebar-header">
      <span class="material-symbols-outlined sidebar-header__icon">settings</span>
      <span class="sidebar-header__title">Настройки</span>
    </div>
    <div class="sidebar-body">

      <div class="form-group">
        <label class="form-label">Формат правила</label>
        <select class="md-field" id="format-select">
          <optgroup label="Apache (mod_alias)">
            <option value="apache-redirect-301">Redirect 301</option>
            <option value="apache-redirect-permanent">RedirectPermanent</option>
            <option value="apache-redirectmatch-301">RedirectMatch 301</option>
            <option value="apache-redirect-410">Redirect 410</option>
          </optgroup>
          <optgroup label="Apache (mod_rewrite)">
            <option value="apache-rewrite-rule" selected>RewriteRule [R=301,L]</option>
            <option value="apache-rewrite-cond-rule">RewriteCond + RewriteRule [NC]</option>
            <option value="apache-rewrite-cond-rule-ne">RewriteCond + RewriteRule [NE]</option>
            <option value="apache-rewrite-rule-with-qs">RewriteRule + Query String</option>
            <option value="apache-rewrite-rule-gone">RewriteRule [G]</option>
          </optgroup>
          <optgroup label="Nginx">
            <option value="nginx-return-301">return 301</option>
            <option value="nginx-rewrite">rewrite permanent</option>
            <option value="nginx-return-410">return 410</option>
          </optgroup>
          <optgroup label="Другое">
            <option value="custom">Кастомный шаблон</option>
          </optgroup>
        </select>
      </div>

      <!-- preview box -->
      <div class="form-group">
        <label class="form-label">Предпросмотр <span class="chip" style="float:right">пример</span></label>
        <div id="preview-container" style="background:var(--md-sys-color-surface-container); border:1px solid var(--md-sys-color-outline-variant); border-radius:8px; padding:10px; font-size:12px;">
          <div style="display:flex; gap:6px; margin-bottom:4px; color:var(--md-sys-color-on-surface-variant);">
            <span>Старый:</span><code style="color:var(--tab-accent)">/old-page</code>
          </div>
          <div id="preview-new-url" style="display:flex; gap:6px; margin-bottom:6px; color:var(--md-sys-color-on-surface-variant);">
            <span>Новый:</span><code style="color:var(--tab-accent)">https://example.com/new-page</code>
          </div>
          <code id="preview-code-result" style="display:block; word-break:break-all; color:var(--md-sys-color-on-surface); font-family:'Roboto Mono',monospace;"></code>
        </div>
      </div>

      <!-- custom template -->
      <div class="form-group" id="custom-template-group" style="display:none">
        <label class="form-label">Кастомный шаблон</label>
        <textarea class="md-field" id="custom-template-textarea" rows="3"
          placeholder="Переменные: {oldUrl} и {newUrl}&#10;Пример: {oldUrl} -> {newUrl} [301]"></textarea>
      </div>

      <!-- default url -->
      <div class="form-group">
        <label class="form-label">URL по умолчанию</label>
        <input type="text" class="md-field" id="default-url-input" value="/" placeholder="/">
      </div>

      <!-- redirect to default toggle -->
      <div class="form-group">
        <label class="md-checkbox">
          <input type="checkbox" id="enable-redirect-to-default-checkbox">
          <span>Режим редиректа на главную</span>
        </label>
        <div id="redirect-to-default-group" style="display:none; margin-top:6px;">
          <button class="md-btn md-btn--outlined md-btn--block" id="redirect-selected-btn">
            <span class="material-symbols-outlined">home</span> Редирект выделенных
          </button>
        </div>
      </div>

      <button class="md-btn md-btn--filled md-btn--block md-btn--lg" id="generate-btn">
        <span class="material-symbols-outlined">bolt</span> Сгенерировать правила
      </button>

      <div class="divider"></div>
      <div class="section-label">Live Redirect Checker</div>

      <div class="form-group">
        <div style="display:flex; gap:6px;">
          <input class="md-field" id="checker-url-input" placeholder="https://example.com/old-page" style="flex:1;">
          <button class="md-btn md-btn--tonal" id="checker-run-btn" title="Проверить">
            <span class="material-symbols-outlined">play_arrow</span>
          </button>
        </div>
      </div>
      <div id="checker-chain-result" style="display:flex; flex-direction:column; gap:4px;"></div>

    </div><!-- /sidebar-body -->
  </aside>

</div><!-- /tool-layout -->
```

---

## TASK 2 — Image Optimizer: restore 3-column layout

**File:** `src/renderer/index.html` — `#panel-optimizer`  
**File:** `src/renderer/ujimator-app.js`

Rebuild `#panel-optimizer` inner layout. Keep ALL existing IDs and JS event hooks intact — only restructure HTML:

```html
<div class="tool-layout">

  <!-- LEFT: file list -->
  <aside class="tool-sidebar tool-sidebar--left">
    <div class="sidebar-header">
      <span class="material-symbols-outlined sidebar-header__icon">folder</span>
      <span class="sidebar-header__title">Файлы</span>
      <span class="chip chip--accent" id="totalFiles">0</span>
    </div>
    <div style="display:flex; gap:6px; padding:8px 10px; border-bottom:1px solid var(--md-sys-color-outline-variant); flex-shrink:0;">
      <button class="md-btn md-btn--tonal md-btn--sm" id="btnSelectFiles">
        <span class="material-symbols-outlined">description</span> Файлы
      </button>
      <button class="md-btn md-btn--tonal md-btn--sm" id="btnSelectFolders">
        <span class="material-symbols-outlined">folder_open</span> Папки
      </button>
      <button class="md-btn md-btn--outlined md-btn--sm" id="btnClearFiles" title="Очистить">
        <span class="material-symbols-outlined">delete</span>
      </button>
    </div>
    <div class="file-list" id="fileList" style="flex:1; overflow-y:auto; padding:8px;">
      <div class="empty-state" id="emptyState">
        <span class="material-symbols-outlined">photo_library</span>
        <div class="empty-state__title">Перетащите файлы сюда</div>
      </div>
    </div>
  </aside>

  <!-- CENTER: drop zone / comparison / results -->
  <section class="tool-main">
    <!-- Drop zone -->
    <div class="drop-zone" id="dropZone" style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:40px;">
      <span class="material-symbols-outlined" style="font-size:56px; color:var(--tab-accent); opacity:.4;">file_download</span>
      <div style="text-align:center;">
        <div style="font-size:18px; font-weight:500; margin-bottom:6px;">Перетащите изображения</div>
        <div style="font-size:13px; color:var(--md-sys-color-on-surface-variant);">JPG, PNG, WebP, GIF, SVG, TIFF</div>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="md-btn md-btn--filled" id="btnDropSelectFiles">
          <span class="material-symbols-outlined">description</span> Выбрать файлы
        </button>
        <button class="md-btn md-btn--outlined" id="btnDropSelectFolders">
          <span class="material-symbols-outlined">folder_open</span> Выбрать папки
        </button>
      </div>
    </div>

    <!-- Comparison preview (hidden by default) -->
    <div id="previewContainer" style="display:none; flex:1; flex-direction:column; overflow:hidden;">
      <!-- keep existing comparison slider markup here -->
    </div>

    <!-- Results summary (hidden by default) -->
    <div id="resultsSummary" style="display:none; flex:1; overflow-y:auto; padding:16px;">
      <!-- keep existing results markup here -->
    </div>

    <!-- Results table (hidden by default) -->
    <div class="table-wrap" id="resultsTableWrap" style="display:none; flex:1; overflow:auto;">
      <table class="data-table" id="resultsTable">
        <thead>
          <tr>
            <th style="width:4%"></th>
            <th>Файл</th>
            <th style="width:12%">До</th>
            <th style="width:12%">После</th>
            <th style="width:12%">Сжатие</th>
            <th style="width:8%"></th>
          </tr>
        </thead>
        <tbody id="resultsTableBody"></tbody>
      </table>
    </div>

    <!-- Progress bar (footer) -->
    <div class="progress-footer" id="progressContainer" style="display:none;">
      <div class="progress-footer__info">
        <span class="progress-footer__status" id="progressStatus">Обработка…</span>
        <span class="progress-footer__file" id="progressFile">—</span>
        <span class="progress-footer__count" id="progressDetail">0 / 0</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" id="progressFill" style="width:0%"></div>
      </div>
    </div>
  </section>

  <!-- RIGHT: settings panel -->
  <aside class="tool-sidebar tool-sidebar--right">
    <div class="sidebar-header">
      <span class="material-symbols-outlined sidebar-header__icon">tune</span>
      <span class="sidebar-header__title">Настройки</span>
    </div>
    <div class="sidebar-body">

      <!-- Presets -->
      <div class="form-group">
        <label class="form-label">Пресет</label>
        <div style="display:flex; gap:6px;">
          <button class="md-btn md-btn--tonal md-btn--sm preset-btn" data-preset="optimal" style="flex:1;">
            <span class="material-symbols-outlined" style="font-size:14px;">bolt</span> Оптимально
          </button>
          <button class="md-btn md-btn--outlined md-btn--sm preset-btn" data-preset="quality" style="flex:1;">
            <span class="material-symbols-outlined" style="font-size:14px;">diamond</span> Качество
          </button>
          <button class="md-btn md-btn--outlined md-btn--sm preset-btn" data-preset="size" style="flex:1;">
            <span class="material-symbols-outlined" style="font-size:14px;">storage</span> Размер
          </button>
        </div>
      </div>

      <!-- Quality slider -->
      <div class="form-group">
        <label class="form-label">Качество: <span id="qualityValue" style="color:var(--tab-accent);">85%</span></label>
        <input type="range" id="qualitySlider" min="1" max="100" value="85">
      </div>

      <!-- Compression level -->
      <div class="form-group">
        <label class="form-label">МеньшеЛучше / Сжатие: <span id="levelValue" style="color:var(--tab-accent);">2/10</span></label>
        <input type="range" id="levelSlider" min="1" max="9" value="2">
      </div>

      <!-- Resize -->
      <div class="form-group">
        <label class="form-label">Изменение размера</label>
        <select class="md-field" id="resizeSelect">
          <option value="">Оригинальный размер</option>
          <option value="1920">1920px (Full HD)</option>
          <option value="1280">1280px (HD)</option>
          <option value="1080">1080px</option>
          <option value="800">800px</option>
          <option value="custom">Кастомный</option>
        </select>
      </div>

      <div class="divider"></div>

      <!-- Checkboxes -->
      <label class="md-checkbox"><input type="checkbox" id="convertFormatCheckbox" checked><span>Конвертировать формат</span></label>
      <label class="md-checkbox"><input type="checkbox" id="createBackupCheckbox" checked><span>Резервные копии</span></label>
      <label class="md-checkbox"><input type="checkbox" id="keepResolutionCheckbox" checked><span>Сохранять размер</span></label>
      <label class="md-checkbox"><input type="checkbox" id="removeMetadataCheckbox"><span>Удалять EXIF</span></label>
      <label class="md-checkbox"><input type="checkbox" id="useSlugCheckbox"><span>ЧПУ имена</span></label>

      <div class="divider"></div>

      <!-- Backup folder -->
      <div class="form-group">
        <label class="form-label">Папка бэкапов</label>
        <div style="display:flex; gap:6px;">
          <input class="md-field" id="backupFolderInput" placeholder="./backup" style="flex:1;" readonly>
          <button class="md-btn md-btn--tonal" id="btnSelectBackupFolder">
            <span class="material-symbols-outlined">folder_open</span>
          </button>
        </div>
      </div>

      <button class="md-btn md-btn--filled md-btn--block md-btn--lg" id="btnOptimize" disabled>
        <span class="material-symbols-outlined">rocket_launch</span> Оптимизировать
      </button>

    </div><!-- /sidebar-body -->
  </aside>

</div><!-- /tool-layout -->
```

---

## TASK 3 — CSS: tab accent propagation

**File:** `src/renderer/styles.css`

Ensure these rules exist and cover ALL interactive elements inside tab panels:

```css
/* Sidebar header icon uses tab accent */
.sidebar-header__icon { color: var(--tab-accent); }

/* Filled button uses tab accent as bg */
.md-btn--filled { background: var(--tab-accent); color: #0d1117; }

/* Tonal button */
.md-btn--tonal { background: var(--tab-accent-dim); color: var(--tab-accent); }

/* Chip accent */
.chip--accent { background: var(--tab-accent-dim); color: var(--tab-accent); }

/* Checkbox checked state */
.md-checkbox input[type=checkbox]:checked {
  background: var(--tab-accent);
  border-color: var(--tab-accent);
}

/* Range slider thumb */
input[type=range]::-webkit-slider-thumb { background: var(--tab-accent); }

/* Progress fill */
.progress-fill { background: var(--tab-accent); }

/* Mode tab active */
.mode-tab.active { color: var(--tab-accent); border-bottom-color: var(--tab-accent); }

/* Table row selected */
.data-table tr.selected td { background: var(--tab-accent-dim); }

/* Focus ring on inputs */
.md-field:focus { border-color: var(--tab-accent); }

/* Active tab in titlebar */
.tab-item.active { color: var(--tab-accent); border-bottom-color: var(--tab-accent); }
.tab-item.active .tab-icon { color: var(--tab-accent); }
```

---

## TASK 4 — app.js: per-tab accent on switch

**File:** `src/renderer/app.js`

In the tab activation function, make sure this line exists:
```js
document.body.dataset.tab = target; // triggers CSS var switch
```

Also ensure the initial call on page load:
```js
activateTab('redirect'); // sets body[data-tab="redirect"] → blue accent
```

---

## TASK 5 — Typography and spacing consistency

**File:** `src/renderer/styles.css`

Apply to ALL sidebars across all 5 tabs:

```css
.sidebar-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--md-sys-color-on-surface-variant);
}

.section-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .8px;
  color: var(--md-sys-color-outline);
  padding: 2px 0;
}

.divider {
  height: 1px;
  background: var(--md-sys-color-outline-variant);
  margin: 2px 0;
}
```

---

## TASK 6 — Titlebar tab spacing and icon alignment

**File:** `src/renderer/styles.css`

Fix tab items to look tight and clean:

```css
.titlebar-tabs { gap: 0; padding: 0 8px; }

.tab-item {
  padding: 0 13px;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: .1px;
  height: 100%;
  border-bottom: 2px solid transparent;
}

.tab-icon { font-size: 15px; line-height: 1; }
```

---

## TASK 7 — Drop zone polish (Image Optimizer center)

**File:** `src/renderer/styles.css`

```css
.drop-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
  border: 2px dashed var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-lg);
  margin: 12px;
  transition: border-color var(--md-duration-short), background var(--md-duration-short);
  cursor: default;
}

.drop-zone.drag-over {
  border-color: var(--tab-accent);
  background: var(--tab-accent-dim);
}

.drop-zone__icon {
  font-size: 52px;
  color: var(--tab-accent);
  opacity: .35;
  transition: opacity .2s;
}

.drop-zone.drag-over .drop-zone__icon { opacity: .7; }
```

---

## TASK 8 — File list item style (Image Optimizer left sidebar)

**File:** `src/renderer/styles.css`

```css
.file-list { flex: 1; overflow-y: auto; padding: 6px; }

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--md-sys-shape-sm);
  font-size: 12.5px;
  cursor: pointer;
  transition: background var(--md-duration-short);
}

.file-item:hover { background: rgba(255,255,255,.04); }
.file-item.selected { background: var(--tab-accent-dim); }

.file-item__icon { font-size: 16px; color: var(--tab-accent); flex-shrink: 0; }
.file-item__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-item__size { font-size: 11px; color: var(--md-sys-color-outline); flex-shrink: 0; }

.file-item__status { font-size: 14px; flex-shrink: 0; }
.file-item__status--ok      { color: #4ade80; }
.file-item__status--error   { color: #f87171; }
.file-item__status--pending { color: var(--md-sys-color-outline); }
```

---

## TASK 9 — Generated rules textarea style

**File:** `src/renderer/styles.css`

Replace any `.code-area` or `.results-panel` old styles with:

```css
.output-code {
  width: 100%;
  min-height: 110px;
  max-height: 160px;
  resize: vertical;
  padding: 10px 14px;
  background: var(--md-sys-color-surface-container-lowest);
  border: none;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  outline: none;
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
  line-height: 1.65;
  color: var(--md-sys-color-on-surface);
  user-select: text;
}

.output-code::placeholder { color: var(--md-sys-color-outline); }
```

Apply class `output-code` to `#results-textarea`.

---

## TASK 10 — QA checklist before finishing

After all tasks, verify:

- [ ] All 5 tabs have `class="tool-layout"` with exactly 3 children: `.tool-sidebar--left`, `.tool-main`, `.tool-sidebar--right`
- [ ] `body[data-tab="redirect"]` sets `--tab-accent: #60a5fa` (blue)
- [ ] `body[data-tab="optimizer"]` sets `--tab-accent: #94a3b8` (slate)
- [ ] `body[data-tab="parser"]` sets `--tab-accent: #4ade80` (green)
- [ ] `body[data-tab="downloader"]` sets `--tab-accent: #c084fc` (purple)
- [ ] `body[data-tab="clusterer"]` sets `--tab-accent: #fb923c` (orange)
- [ ] Active tab in titlebar uses `var(--tab-accent)` for color and border
- [ ] All `.md-btn--filled` buttons use `var(--tab-accent)` background
- [ ] `.sidebar-header__icon` uses `var(--tab-accent)` color
- [ ] Progress bars (optimizer + downloader) use `var(--tab-accent)` fill
- [ ] Checked checkboxes use `var(--tab-accent)` background
- [ ] Range slider thumbs use `var(--tab-accent)`
- [ ] No old beige/green `#8EDB98` colors remain anywhere
- [ ] No `tab-soon` disabled buttons exist in titlebar
- [ ] Drop zone has dashed border that glows `var(--tab-accent)` on drag-over
- [ ] All JS IDs referenced in `redirect-app.js` and `ujimator-app.js` still exist in rebuilt HTML

---

## IMPORTANT NOTES FOR AI

1. **Do NOT touch** `src/main/*.js` files — only renderer files
2. **Do NOT break** existing JS event listeners — all `id=""` attributes must remain identical
3. **Do NOT use** any external CSS libraries (no Tailwind CDN, no Bootstrap)
4. **Do NOT add** `<style>` blocks inline — all CSS goes into `styles.css`
5. The design system is **already defined** in `styles.css` — reuse existing classes
6. When in doubt: look at how `#panel-parser` is structured — it is the reference implementation

---

## TASK 11 — install.bat: auto-install Node + Python dependencies

**File:** `install.bat` (root of project)

Rewrite `install.bat` to handle both Node.js and Python dependencies in one step:

```bat
@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title SEO Scripts — Install

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║        SEO Scripts v2 — Installing dependencies     ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: ── 1. Node.js ───────────────────────────────────────────────────────────────
echo [1/3] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo        Node.js %%v — OK
echo.

echo [2/3] Installing Node.js packages (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause & exit /b 1
)
echo        node_modules — OK
echo.

:: ── 2. Python ────────────────────────────────────────────────────────────────
echo [3/3] Checking Python for Keyword Clusterer...
set PYTHON_CMD=

python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python3
    for /f "tokens=*" %%v in ('python3 --version 2^>^&1') do echo        %%v found
    goto :install_python_deps
)

python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo        %%v found
    goto :install_python_deps
)

echo [WARN] Python not found — Keyword Clusterer tab will be disabled.
echo        Install Python 3.8+ from https://python.org if you need clustering.
goto :done

:install_python_deps
echo        Installing Python packages: scikit-learn numpy nltk...
%PYTHON_CMD% -m pip install --quiet --upgrade scikit-learn numpy nltk
if %errorlevel% neq 0 (
    echo [WARN] pip install failed. Try manually: pip install scikit-learn numpy nltk
) else (
    echo        scikit-learn, numpy, nltk — OK
    :: Download NLTK stopwords silently
    %PYTHON_CMD% -c "import nltk; nltk.download('stopwords', quiet=True)" >nul 2>&1
    echo        NLTK stopwords — OK
)

:done
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║   ✓  Installation complete! Run: npm start          ║
echo ╚══════════════════════════════════════════════════════╝
echo.
pause
```

> **Note:** Keep `build.bat` separate — it handles PyInstaller + electron-builder.  
> `install.bat` is only for development environment setup.

---

## TASK 12 — parser.js: smart HTML → Markdown converter

**File:** `src/main/parser.js`

The current text extraction in section `## 📝 Текст страницы` dumps raw plain text — all tables, lists, links, quotes collapsed into a single unformatted string.

**Replace** the `toMarkdown()` function's text section AND the `parseHtml()` text extraction with a proper recursive HTML-to-Markdown converter:

### Step A — Replace text extraction in `parseHtml()`

Remove the current naive `.replace(/<[^>]+>/g, ' ')` approach.  
Instead, call `htmlToMd(bodyHtml)` on the main content area:

```js
if (opts.text) {
    // Extract main content area — try article, main, .content, body in order
    const mainMatch =
        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
        html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
        html.match(/<div[^>]+class=["'][^"']*(?:content|entry|post-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    const bodyHtml = mainMatch ? mainMatch[1] : html;
    result.text = htmlToMd(bodyHtml);
}
```

### Step B — Add `htmlToMd()` function before `parseHtml()`

```js
/**
 * Converts HTML fragment to clean Markdown.
 * Handles: headings, paragraphs, bold, italic, links, images,
 *          unordered/ordered lists, tables, blockquotes, code, pre, hr.
 */
function htmlToMd(html) {
    if (!html) return '';

    // Remove script, style, noscript, svg, nav, footer, header blocks entirely
    html = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '');

    // Decode HTML entities first
    const decode = (s) => s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));

    // ── Tables ──────────────────────────────────────────────────────────────
    html = html.replace(/<table[\s\S]*?<\/table>/gi, (table) => {
        const rows = [];
        const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let trMatch;
        while ((trMatch = trPattern.exec(table)) !== null) {
            const cells = [];
            const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
            let cellMatch;
            while ((cellMatch = cellPattern.exec(trMatch[1])) !== null) {
                const cellText = decode(cellMatch[1].replace(/<[^>]+>/g, '').trim());
                cells.push(cellText || ' ');
            }
            if (cells.length) rows.push(cells);
        }

        if (!rows.length) return '';

        const md = [];
        md.push('| ' + rows[0].join(' | ') + ' |');
        md.push('|' + rows[0].map(() => '---|').join(''));
        for (let i = 1; i < rows.length; i++) {
            // Pad row to header width
            while (rows[i].length < rows[0].length) rows[i].push(' ');
            md.push('| ' + rows[i].join(' | ') + ' |');
        }
        return '\n\n' + md.join('\n') + '\n\n';
    });

    // ── Headings ─────────────────────────────────────────────────────────────
    for (let i = 6; i >= 1; i--) {
        html = html.replace(new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi'), (_, inner) => {
            const text = decode(inner.replace(/<[^>]+>/g, '').trim());
            return text ? `\n\n${'#'.repeat(i)} ${text}\n\n` : '';
        });
    }

    // ── Blockquotes ───────────────────────────────────────────────────────────
    html = html.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
        const text = decode(inner.replace(/<[^>]+>/g, ' ').trim());
        return '\n\n' + text.split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
    });

    // ── Links ─────────────────────────────────────────────────────────────────
    html = html.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
        const text = decode(inner.replace(/<[^>]+>/g, '').trim());
        if (!text || text === href) return href;
        // Skip anchors, javascript:, mailto: — render as plain text
        if (href.startsWith('#') || href.startsWith('javascript:')) return text;
        if (href.startsWith('mailto:')) return `[${text}](${href})`;
        if (href.startsWith('tel:') || href.startsWith('viber:') || href.startsWith('whatsapp:')) return `[${text}](${href})`;
        return `[${text}](${href})`;
    });

    // ── Images (inline) ───────────────────────────────────────────────────────
    html = html.replace(/<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*\/?>/gi, (_, src, alt) => {
        return alt ? `![${alt}](${src})` : `![](${src})`;
    });

    // ── Bold / Strong ─────────────────────────────────────────────────────────
    html = html.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (_, inner) => {
        const text = inner.replace(/<[^>]+>/g, '').trim();
        return text ? `**${decode(text)}**` : '';
    });

    // ── Italic / Em ───────────────────────────────────────────────────────────
    html = html.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, (_, inner) => {
        const text = inner.replace(/<[^>]+>/g, '').trim();
        return text ? `*${decode(text)}*` : '';
    });

    // ── Inline code ───────────────────────────────────────────────────────────
    html = html.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, inner) => {
        const text = decode(inner.replace(/<[^>]+>/g, '').trim());
        return text ? `\`${text}\`` : '';
    });

    // ── Pre / code blocks ─────────────────────────────────────────────────────
    html = html.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner) => {
        const text = decode(inner.replace(/<[^>]+>/g, '').trim());
        return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
    });

    // ── Unordered lists ───────────────────────────────────────────────────────
    html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
        const items = [];
        const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let m;
        while ((m = liPattern.exec(inner)) !== null) {
            const text = decode(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
            if (text) items.push(`- ${text}`);
        }
        return items.length ? '\n\n' + items.join('\n') + '\n\n' : '';
    });

    // ── Ordered lists ─────────────────────────────────────────────────────────
    html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
        const items = [];
        let n = 1;
        const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let m;
        while ((m = liPattern.exec(inner)) !== null) {
            const text = decode(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
            if (text) items.push(`${n++}. ${text}`);
        }
        return items.length ? '\n\n' + items.join('\n') + '\n\n' : '';
    });

    // ── Details / Summary (FAQ-like) ──────────────────────────────────────────
    html = html.replace(/<details[^>]*>([\s\S]*?)<\/details>/gi, (_, inner) => {
        const summaryMatch = inner.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
        const summaryText = summaryMatch
            ? decode(summaryMatch[1].replace(/<[^>]+>/g, '').trim())
            : 'Details';
        const bodyText = inner
            .replace(/<summary[\s\S]*?<\/summary>/i, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return `\n\n**${summaryText}**\n${decode(bodyText)}\n\n`;
    });

    // ── HR ────────────────────────────────────────────────────────────────────
    html = html.replace(/<hr[^>]*\/?>/gi, '\n\n---\n\n');

    // ── Line breaks ───────────────────────────────────────────────────────────
    html = html.replace(/<br[^>]*\/?>/gi, '  \n');

    // ── Paragraphs and divs ───────────────────────────────────────────────────
    html = html.replace(/<\/p>/gi, '\n\n');
    html = html.replace(/<\/div>/gi, '\n');
    html = html.replace(/<p[^>]*>/gi, '');
    html = html.replace(/<div[^>]*>/gi, '');

    // ── Strip remaining tags ──────────────────────────────────────────────────
    html = html.replace(/<[^>]+>/g, '');

    // ── Final cleanup ─────────────────────────────────────────────────────────
    html = decode(html);
    html = html
        .replace(/\n{4,}/g, '\n\n\n')   // max 3 consecutive newlines
        .replace(/[ \t]+\n/g, '\n')       // trailing spaces on lines
        .replace(/\n[ \t]+/g, '\n')       // leading spaces on lines
        .trim();

    return html;
}
```

### Step C — Update `toMarkdown()` text section

In the `toMarkdown()` function, replace the plain text section with proper Markdown rendering:

```js
// Text content — already converted to MD by htmlToMd()
if (data.text) {
    add('## 📝 Содержимое страницы');
    add('');
    add(data.text);   // already formatted Markdown — no wrapping needed
    add('');
}
```

> **Expected result after this task:**  
> A price table like `| Сухая стяжка | от 8 Br | от 16,5 Br |` renders as a proper MD table.  
> Navigation lists like `- Сухая стяжка`, `- Полусухая стяжка` render as bullet lists.  
> Phone links render as `[+375(44)585-33-99](tel:+375445853399)`.  
> Section headings like `## Цены на стяжку пола` stay as headings, not mixed into body text.  
> FAQ answers keep their question-answer structure.

---

## UPDATED QA CHECKLIST (add to Task 10)

- [ ] `install.bat` runs `npm install` + `pip install scikit-learn numpy nltk` in sequence
- [ ] `install.bat` gracefully skips Python section if Python not found (shows warning, not error)
- [ ] `install.bat` is separate from `build.bat` (install = dev setup, build = production exe)
- [ ] `htmlToMd()` exists in `src/main/parser.js` before `parseHtml()`
- [ ] Tables in page content render as `| col | col |` Markdown tables
- [ ] Unordered lists render as `- item` (not inline text)
- [ ] Ordered lists render as `1. item`, `2. item`
- [ ] Anchor tags render as `[text](href)` links
- [ ] `<strong>` / `<b>` renders as `**bold**`
- [ ] `<em>` / `<i>` renders as `*italic*`
- [ ] `<blockquote>` renders as `> quote`
- [ ] `<details>/<summary>` (FAQ) renders as `**Question**\nAnswer`
- [ ] Nav, footer, header blocks are stripped before conversion
- [ ] No raw `&amp;` `&nbsp;` `&lt;` entities in final MD output
- [ ] Multiple consecutive blank lines collapsed to max 3
