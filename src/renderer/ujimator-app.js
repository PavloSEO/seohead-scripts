/* ═══════════════════════════════════════════════════════════════════════════
   SEO Scripts — УжЫматор (Image Optimizer)
   Clean rewrite: no debug logs, uses window.api.optimizer namespace, MD3 UI
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

// ── State ────────────────────────────────────────────────────────────────────
const state = {
    files: [],
    settings: {
        quality: 85,
        level: 2,
        createBackup: true,
        keepResolution: true,
        removeMetadata: true,
        useSlug: false,
        backupFolder: null,
        resizeMode: 'none',
        resizePercent: 100,
        resizeMaxSide: 1920,
        resizeExactWidth: 1920,
        resizeExactHeight: 1080,
        resizeKeepAspect: true,
        convertFormat: false,
        targetFormat: 'jpeg'
    },
    isProcessing: false,
    selectedFile: null,
    lastResults: null,
    lastView: 'dropZone',
    backupMap: new Map(),
    processedResults: new Map(),
    errorMap: new Map()
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const el = {
    fileList:           document.getElementById('fileList'),
    totalFiles:         document.getElementById('totalFiles'),
    btnSelectFiles:     document.getElementById('btnSelectFiles'),
    btnSelectFolders:   document.getElementById('btnSelectFolders'),
    btnClearFiles:      document.getElementById('btnClearFiles'),
    dropZone:           document.getElementById('dropZone'),
    btnDropSelectFiles: document.getElementById('btnDropSelectFiles'),
    btnDropSelectFolders:document.getElementById('btnDropSelectFolders'),
    previewContainer:   document.getElementById('previewContainer'),
    comparisonRange:    document.getElementById('comparisonRange'),
    comparisonDivider:  document.getElementById('comparisonDivider'),
    comparisonAfter:    document.getElementById('comparisonAfter'),
    imgBefore:          document.getElementById('imgBefore'),
    imgAfter:           document.getElementById('imgAfter'),
    btnClosePreview:    document.getElementById('btnClosePreview'),
    btnBackToResults:   document.getElementById('btnBackToResults'),
    sizeBefore:         document.getElementById('sizeBefore'),
    sizeAfter:          document.getElementById('sizeAfter'),
    sizeSaved:          document.getElementById('sizeSaved'),
    resultsSummary:     document.getElementById('resultsSummary'),
    statOriginal:       document.getElementById('statOriginal'),
    statOptimized:      document.getElementById('statOptimized'),
    statSaved:          document.getElementById('statSaved'),
    btnOpenFolder:      document.getElementById('btnOpenFolder'),
    btnNewSession:      document.getElementById('btnNewSession'),
    presetOptimal:      document.getElementById('presetOptimal'),
    presetQuality:      document.getElementById('presetQuality'),
    presetSize:         document.getElementById('presetSize'),
    qualityRange:       document.getElementById('qualityRange'),
    qualityValue:       document.getElementById('qualityValue'),
    levelRange:         document.getElementById('levelRange'),
    levelValue:         document.getElementById('levelValue'),
    toggleBackup:       document.getElementById('toggleBackup'),
    toggleResolution:   document.getElementById('toggleResolution'),
    toggleMetadata:     document.getElementById('toggleMetadata'),
    toggleSlug:         document.getElementById('toggleSlug'),
    backupFolderInput:  document.getElementById('backupFolderInput'),
    btnSelectBackupFolder: document.getElementById('btnSelectBackupFolder'),
    btnOptimize:        document.getElementById('btnOptimize'),
    resizeMode:         document.getElementById('resizeMode'),
    resizeOptionsGroup: document.getElementById('resizeOptionsGroup'),
    percentRange:       document.getElementById('percentRange'),
    percentValue:       document.getElementById('percentValue'),
    maxSideInput:       document.getElementById('maxSideInput'),
    exactWidthInput:    document.getElementById('exactWidthInput'),
    exactHeightInput:   document.getElementById('exactHeightInput'),
    exactKeepAspect:    document.getElementById('exactKeepAspect'),
    toggleConvert:      document.getElementById('toggleConvert'),
    convertFormatGroup: document.getElementById('convertFormatGroup'),
    targetFormat:       document.getElementById('targetFormat'),
    progressContainer:  document.getElementById('progressContainer'),
    progressStatus:     document.getElementById('progressStatus'),
    progressDetail:     document.getElementById('progressDetail'),
    progressFill:       document.getElementById('progressFill'),
    progressFile:       document.getElementById('progressFile')
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    const r = await window.api.optimizer.getSettings();
    if (r.success) Object.assign(state.settings, r.settings);
    updateSettingsUI();
    bindEvents();
    window.api.optimizer.onProgress(handleProgress);
}

// ── Events ────────────────────────────────────────────────────────────────────
function bindEvents() {
    el.btnSelectFiles?.addEventListener('click', selectFiles);
    el.btnSelectFolders?.addEventListener('click', selectFolders);
    el.btnDropSelectFiles?.addEventListener('click', selectFiles);
    el.btnDropSelectFolders?.addEventListener('click', selectFolders);
    el.btnClearFiles?.addEventListener('click', clearFiles);

    document.body.addEventListener('dragover', e => { e.preventDefault(); el.dropZone?.classList.add('is-dragging'); });
    document.body.addEventListener('dragleave', e => { if (!e.relatedTarget) el.dropZone?.classList.remove('is-dragging'); });
    document.body.addEventListener('drop', handleDrop);

    el.comparisonRange?.addEventListener('input', e => updateSlider(e.target.value));
    el.btnClosePreview?.addEventListener('click', closePreview);
    el.btnBackToResults?.addEventListener('click', backToResults);
    el.btnOpenFolder?.addEventListener('click', openResultFolder);
    el.btnNewSession?.addEventListener('click', newSession);

    el.presetOptimal?.addEventListener('click', () => applyPreset('optimal'));
    el.presetQuality?.addEventListener('click', () => applyPreset('quality'));
    el.presetSize?.addEventListener('click',    () => applyPreset('size'));

    el.qualityRange?.addEventListener('input', e => { state.settings.quality = +e.target.value; el.qualityValue.textContent = e.target.value; clearActivePreset(); });
    el.levelRange?.addEventListener('input',   e => { state.settings.level   = +e.target.value; el.levelValue.textContent   = e.target.value; clearActivePreset(); });

    el.toggleBackup?.addEventListener('change',     e => state.settings.createBackup    = e.target.checked);
    el.toggleResolution?.addEventListener('change', e => state.settings.keepResolution  = e.target.checked);
    el.toggleMetadata?.addEventListener('change',   e => state.settings.removeMetadata  = e.target.checked);
    el.toggleSlug?.addEventListener('change',       e => state.settings.useSlug         = e.target.checked);

    el.btnSelectBackupFolder?.addEventListener('click', selectBackupFolder);
    el.btnOptimize?.addEventListener('click', startOptimization);

    el.resizeMode?.addEventListener('change', handleResizeModeChange);
    el.percentRange?.addEventListener('input',    e => { state.settings.resizePercent     = +e.target.value; el.percentValue.textContent = e.target.value; });
    el.maxSideInput?.addEventListener('input',    e => { state.settings.resizeMaxSide      = +e.target.value; });
    el.exactWidthInput?.addEventListener('input', e => { state.settings.resizeExactWidth   = +e.target.value; });
    el.exactHeightInput?.addEventListener('input',e => { state.settings.resizeExactHeight  = +e.target.value; });
    el.exactKeepAspect?.addEventListener('change',e => { state.settings.resizeKeepAspect  = e.target.checked; });

    el.toggleConvert?.addEventListener('change', handleConvertChange);
    el.targetFormat?.addEventListener('change',  e => state.settings.targetFormat = e.target.value);
}

// ── Files ─────────────────────────────────────────────────────────────────────
async function selectFiles() {
    const files = await window.api.optimizer.selectFiles();
    if (files.length) addFiles(files);
}
async function selectFolders() {
    const folders = await window.api.optimizer.selectFolders();
    if (!folders.length) return;
    const r = await window.api.optimizer.scanPaths(folders);
    if (r.success && r.files.length) { addFiles(r.files); showToast(`Добавлено ${r.files.length} файлов`); }
    else showToast('Изображения не найдены', 'error');
}
async function selectBackupFolder() {
    const folder = await window.api.optimizer.selectBackupFolder();
    if (folder) { state.settings.backupFolder = folder; el.backupFolderInput.value = folder; }
}

function addFiles(paths) {
    let added = 0;
    paths.forEach(p => { if (!state.files.includes(p)) { state.files.push(p); added++; } });
    if (added > 0) { renderFileList(); updateUI(); }
}
function removeFile(path) {
    state.files = state.files.filter(f => f !== path);
    state.backupMap.delete(path);
    state.processedResults.delete(path);
    state.errorMap.delete(path);
    if (state.selectedFile === path) state.selectedFile = null;
    renderFileList(); updateUI();
}
function clearFiles() {
    state.files = []; state.backupMap.clear(); state.processedResults.clear();
    state.errorMap.clear(); state.selectedFile = null; state.lastResults = null;
    state.lastView = 'dropZone';
    renderFileList(); updateUI(); closePreview(); hideResults();
}

async function handleDrop(e) {
    e.preventDefault();
    el.dropZone?.classList.remove('is-dragging');
    const paths = Array.from(e.dataTransfer.files).map(f => f.path);
    if (!paths.length) return;
    const r = await window.api.optimizer.scanPaths(paths);
    if (r.success && r.files.length) addFiles(r.files);
}

// ── File list render ──────────────────────────────────────────────────────────
function renderFileList() {
    el.fileList.innerHTML = '';
    if (!state.files.length) {
        el.fileList.innerHTML = `
            <div class="empty-state" id="emptyState">
                <span class="material-symbols-outlined empty-state__icon">photo_library</span>
                <p>Перетащите файлы сюда</p>
            </div>`;
        return;
    }
    state.files.forEach((filePath, idx) => {
        const item = createFileItem(filePath, idx);
        el.fileList.appendChild(item);
    });
}

function createFileItem(filePath, idx) {
    const name = filePath.split(/[/\\]/).pop();
    const ext = name.split('.').pop().toLowerCase();
    const iconMap = { svg: 'code', gif: 'gif_box' };
    const iconName = iconMap[ext] || 'image';

    const div = document.createElement('div');
    div.className = 'file-item';
    div.dataset.path = filePath;
    div.style.animationDelay = Math.min(idx * 0.02, 0.1) + 's';

    const safeName = name.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    div.innerHTML = `
        <span class="material-symbols-outlined file-item__icon">${iconName}</span>
        <span class="file-item__name" title="${filePath.replace(/"/g,'')}">${safeName}</span>
        <span class="file-item__size">…</span>
        <button class="file-item__rm md-btn md-btn--text md-btn--danger md-btn--icon md-btn--sm" title="Удалить">
            <span class="material-symbols-outlined" style="font-size:14px">close</span>
        </button>`;

    // Status overlay applied later
    if (state.processedResults.has(filePath)) {
        const res = state.processedResults.get(filePath);
        div.classList.add('file-item--done');
        div.querySelector('.file-item__size').textContent = `-${res.percent}%`;
    } else if (state.errorMap.has(filePath)) {
        div.classList.add('file-item--error');
    }

    div.addEventListener('click', e => {
        if (!e.target.closest('.file-item__rm')) selectFileForPreview(filePath, div);
    });
    div.querySelector('.file-item__rm').addEventListener('click', e => { e.stopPropagation(); removeFile(filePath); });

    loadFileSize(div, filePath);
    return div;
}

async function loadFileSize(el, filePath) {
    const sizeEl = el.querySelector('.file-item__size');
    if (!sizeEl || state.processedResults.has(filePath)) return;
    try {
        const r = await window.api.optimizer.getFileInfo(filePath);
        if (r.success && sizeEl) {
            let txt = r.info.sizeFormatted;
            if (r.info.width && r.info.height) txt += ` · ${r.info.width}×${r.info.height}`;
            sizeEl.textContent = txt;
        }
    } catch {}
}

// ── Preview ────────────────────────────────────────────────────────────────────
async function selectFileForPreview(filePath, element) {
    if (!element || !filePath) return;
    document.querySelectorAll('.file-item').forEach(e => e.classList.remove('is-active'));
    element.classList.add('is-active');
    state.selectedFile = filePath;

    try {
        const after = await window.api.optimizer.getImagePreview(filePath);
        if (!after.success) { showToast('Превью недоступно: ' + after.error, 'error'); return; }
        el.imgAfter.src = after.preview.dataUrl;

        const backupPath = state.backupMap.get(filePath);
        if (backupPath) {
            const before = await window.api.optimizer.getImagePreview(backupPath);
            el.imgBefore.src = before.success ? before.preview.dataUrl : after.preview.dataUrl;
            const [bi, ci] = await Promise.all([
                window.api.optimizer.getFileInfo(backupPath),
                window.api.optimizer.getFileInfo(filePath)
            ]);
            if (bi.success && ci.success) {
                el.sizeBefore.textContent = bi.info.sizeFormatted;
                el.sizeAfter.textContent  = ci.info.sizeFormatted;
                const pct = bi.info.size > 0 ? ((bi.info.size - ci.info.size) / bi.info.size * 100).toFixed(1) : '0.0';
                el.sizeSaved.textContent  = pct + '%';
            }
        } else {
            el.imgBefore.src = after.preview.dataUrl;
            const info = await window.api.optimizer.getFileInfo(filePath);
            if (info.success) { el.sizeBefore.textContent = info.info.sizeFormatted; el.sizeAfter.textContent = '—'; el.sizeSaved.textContent = '—'; }
        }
        showPreview();
    } catch (e) { showToast('Ошибка превью: ' + e.message, 'error'); }
}

function showPreview() {
    state.lastView = el.resultsSummary.style.display !== 'none' ? 'results' : 'dropZone';
    el.dropZone.style.display = 'none';
    el.resultsSummary.style.display = 'none';
    el.previewContainer.style.display = 'flex';
    el.comparisonRange.value = 50;
    updateSlider(50);
    el.btnBackToResults.style.display = (state.lastView === 'results' && state.lastResults) ? 'flex' : 'none';
}
function closePreview() {
    el.previewContainer.style.display = 'none';
    if (state.lastView === 'results' && state.lastResults) {
        el.resultsSummary.style.display = 'flex'; el.dropZone.style.display = 'none';
    } else {
        el.dropZone.style.display = 'flex'; el.resultsSummary.style.display = 'none';
    }
    document.querySelectorAll('.file-item.is-active').forEach(e => e.classList.remove('is-active'));
    state.selectedFile = null;
}
function backToResults() {
    el.previewContainer.style.display = 'none';
    el.dropZone.style.display = 'none';
    document.querySelectorAll('.file-item.is-active').forEach(e => e.classList.remove('is-active'));
    state.selectedFile = null;
    if (state.lastResults) showResults(state.lastResults);
    else { el.dropZone.style.display = 'flex'; state.lastView = 'dropZone'; }
}
function updateSlider(v) {
    el.comparisonAfter.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
    el.comparisonDivider.style.left = v + '%';
}

// ── Presets ───────────────────────────────────────────────────────────────────
function applyPreset(preset) {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    const map = { optimal:{q:85,l:2}, quality:{q:95,l:1}, size:{q:70,l:5} };
    const p = map[preset];
    state.settings.quality = p.q; state.settings.level = p.l;
    document.getElementById('preset' + preset.charAt(0).toUpperCase() + preset.slice(1))?.classList.add('active');
    el.qualityRange.value = p.q; el.qualityValue.textContent = p.q;
    el.levelRange.value   = p.l; el.levelValue.textContent   = p.l;
}
function clearActivePreset() { document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active')); }

// ── Settings UI ───────────────────────────────────────────────────────────────
function handleResizeModeChange() {
    const mode = el.resizeMode.value;
    state.settings.resizeMode = mode;
    el.resizeOptionsGroup.style.display = mode === 'none' ? 'none' : 'block';
    ['resizePercent','resizeMaxSide','resizeExact'].forEach(id => document.getElementById(id).style.display = 'none');
    if (mode === 'percent') document.getElementById('resizePercent').style.display = 'block';
    if (mode === 'maxSide') document.getElementById('resizeMaxSide').style.display = 'block';
    if (mode === 'exact')   document.getElementById('resizeExact').style.display = 'block';
}
function handleConvertChange() {
    state.settings.convertFormat = el.toggleConvert.checked;
    el.convertFormatGroup.style.display = el.toggleConvert.checked ? 'block' : 'none';
}
function updateSettingsUI() {
    el.qualityRange.value     = state.settings.quality;    el.qualityValue.textContent = state.settings.quality;
    el.levelRange.value       = state.settings.level;      el.levelValue.textContent   = state.settings.level;
    el.toggleBackup.checked   = state.settings.createBackup;
    el.toggleResolution.checked = state.settings.keepResolution;
    el.toggleMetadata.checked = state.settings.removeMetadata;
    el.toggleSlug.checked     = state.settings.useSlug;
    if (state.settings.backupFolder) el.backupFolderInput.value = state.settings.backupFolder;
    el.resizeMode.value       = state.settings.resizeMode || 'none';
    el.percentRange.value     = state.settings.resizePercent || 100;   el.percentValue.textContent = state.settings.resizePercent || 100;
    el.maxSideInput.value     = state.settings.resizeMaxSide || 1920;
    el.exactWidthInput.value  = state.settings.resizeExactWidth || 1920;
    el.exactHeightInput.value = state.settings.resizeExactHeight || 1080;
    el.exactKeepAspect.checked= state.settings.resizeKeepAspect !== false;
    el.toggleConvert.checked  = !!state.settings.convertFormat;
    el.targetFormat.value     = state.settings.targetFormat || 'jpeg';
    handleResizeModeChange(); handleConvertChange();
}

// ── Optimization ──────────────────────────────────────────────────────────────
async function startOptimization() {
    if (!state.files.length || state.isProcessing) return;
    state.isProcessing = true;
    updateUI();
    el.progressContainer.style.display = 'flex';
    el.progressFill.style.width = '0%';
    el.progressStatus.textContent = 'Подготовка…';
    closePreview();

    try {
        await window.api.optimizer.saveSettings(state.settings);
        const result = await window.api.optimizer.optimize(state.files, state.settings);
        if (result.success) {
            state.lastResults = result.result;
            showResults(result.result);
            applyResultsToFileList(result.result);
            showToast(`Обработано ${result.result.processed} файлов · −${result.result.savedPercent}%`);
        } else {
            showToast(result.error || 'Неизвестная ошибка', 'error');
        }
    } catch (e) {
        showToast('Ошибка: ' + e.message, 'error');
    }

    state.isProcessing = false;
    updateUI();
    setTimeout(() => el.progressContainer.style.display = 'none', 2000);
}

function handleProgress(data) {
    el.progressFill.style.width = data.percent + '%';
    el.progressStatus.textContent = data.status === 'complete' ? 'Готово!' : 'Обработка…';
    el.progressDetail.textContent = `${data.current} / ${data.total}`;
    el.progressFile.textContent   = data.currentFile || '';
}

// ── Results ────────────────────────────────────────────────────────────────────
function showResults(result) {
    state.lastView = 'results';
    el.dropZone.style.display = 'none';
    el.previewContainer.style.display = 'none';
    el.resultsSummary.style.display = 'flex';

    el.statOriginal.textContent  = result.totalOriginalFormatted;
    el.statOptimized.textContent = result.totalOptimizedFormatted;
    el.statSaved.textContent     = result.savedPercent;

    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '';
    result.results.forEach(r => {
        const row = document.createElement('tr');
        const saved = parseFloat(r.percent) >= 0;
        const fmt   = r.format || r.newName?.split('.').pop()?.toUpperCase() || '?';
        row.innerHTML = `
            <td title="${r.path}">${r.newName}</td>
            <td>${fmtSize(r.originalSize)}</td>
            <td>${fmtSize(r.newSize)}</td>
            <td style="color:var(--md-sys-color-primary)">${saved ? '−' : '+'}${Math.abs(r.percent)}%</td>
            <td><span class="chip chip--secondary">${fmt}</span></td>`;
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            const fileItem = Array.from(document.querySelectorAll('.file-item'))
                .find(e => e.dataset.path === r.path || e.querySelector('.file-item__name')?.textContent === r.newName);
            if (fileItem) selectFileForPreview(r.path, fileItem);
            else showToast('Файл не найден в списке', 'error');
        });
        tbody.appendChild(row);
    });
}
function fmtSize(b) {
    if (!b) return '—';
    if (b < 1024) return b + ' B';
    const kb = b / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' KB';
    return (kb / 1024).toFixed(2) + ' MB';
}
function hideResults() { el.resultsSummary.style.display = 'none'; el.dropZone.style.display = 'flex'; state.lastView = 'dropZone'; }

function applyResultsToFileList(result) {
    result.results.forEach(r => {
        if (r.backupPath) state.backupMap.set(r.path, r.backupPath);
        state.processedResults.set(r.path, r);
        // Update file path if renamed
        if (r.renamed && r.oldName) {
            const idx = state.files.findIndex(f => f.endsWith(r.oldName) || f === r.path);
            if (idx !== -1 && state.files[idx] !== r.path) {
                const old = state.files[idx];
                state.files[idx] = r.path;
                const bk = state.backupMap.get(old);
                if (bk) { state.backupMap.delete(old); state.backupMap.set(r.path, bk); }
            }
        }
    });
    result.errors?.forEach(e => state.errorMap.set(e.file, e.error));
    renderFileList();
}

function openResultFolder() {
    if (!state.files.length) return;
    const f = state.files[0];
    window.api.optimizer.openFolder(f.substring(0, Math.max(f.lastIndexOf('/'), f.lastIndexOf('\\'))));
}
function newSession() { clearFiles(); state.lastResults = null; hideResults(); }

// ── UI ─────────────────────────────────────────────────────────────────────────
function updateUI() {
    el.totalFiles.textContent = state.files.length;
    el.btnOptimize.disabled   = !state.files.length || state.isProcessing;
    el.btnOptimize.innerHTML  = state.isProcessing
        ? '<span class="material-symbols-outlined">hourglass_top</span> Обработка…'
        : '<span class="material-symbols-outlined">rocket_launch</span> Оптимизировать';
}

// ── Toast (local, falls back to global) ─────────────────────────────────────
function showToast(msg, type) {
    if (window.showToast) window.showToast(msg, type === 'error' ? 'error' : '');
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();

})();
