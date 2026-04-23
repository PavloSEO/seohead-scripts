/* ═══════════════════════════════════════════════════════════════════════════
   SEO Scripts — 301 Redirect Generator
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {

// ── State ────────────────────────────────────────────────────────────────────
const state = {
    redirects: [],
    settings: {
        format: 'apache-rewrite-rule',
        customTemplate: '',
        defaultUrl: '/',
        enableRedirectToDefault: false
    }
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const redirectsTbody        = document.getElementById('redirects-tbody');
const redirectCount         = document.getElementById('redirect-count');
const addRedirectBtn        = document.getElementById('add-redirect-btn');
const importExcelBtn        = document.getElementById('import-excel-btn');
const redirectSelectedBtn   = document.getElementById('redirect-selected-btn');
const clearAllBtn           = document.getElementById('clear-all-btn');
const selectAllCheckbox     = document.getElementById('select-all-checkbox');
const formatSelect          = document.getElementById('format-select');
const customTemplateGroup   = document.getElementById('custom-template-group');
const customTemplateTextarea= document.getElementById('custom-template-textarea');
const defaultUrlInput       = document.getElementById('default-url-input');
const enableRTDCheckbox     = document.getElementById('enable-redirect-to-default-checkbox');
const redirectToDefaultGroup= document.getElementById('redirect-to-default-group');
const generateBtn           = document.getElementById('generate-btn');
const resultsTextarea       = document.getElementById('results-textarea');
const copyResultsBtn        = document.getElementById('copy-results-btn');
const clearResultsBtn       = document.getElementById('clear-results-btn');
const modeTabs              = document.querySelectorAll('#redirect-mode-tabs .mode-tab');
const editMode              = document.getElementById('edit-mode');
const pasteMode             = document.getElementById('paste-mode');
const pasteTbody            = document.getElementById('paste-tbody');
const pasteTableContainer   = document.getElementById('paste-table-container');
const applyPasteBtn         = document.getElementById('apply-paste-btn');
const clearPasteBtn         = document.getElementById('clear-paste-btn');
const pasteCount            = document.getElementById('paste-count');

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    await loadSettings();
    setupListeners();
    updateTable();
    await updatePreview();
    addRedirect();
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function loadSettings() {
    try {
        const r = await window.api.redirect.loadSettings();
        if (r.success) {
            state.settings = { ...state.settings, ...r.settings };
            formatSelect.value = state.settings.format;
            customTemplateTextarea.value = state.settings.customTemplate || '';
            defaultUrlInput.value = state.settings.defaultUrl || '/';
            enableRTDCheckbox.checked = state.settings.enableRedirectToDefault || false;
            toggleCustomTemplate();
            toggleRTDMode();
        }
    } catch (e) { console.error('load settings error', e); }
}

async function saveSettings() {
    state.settings.format = formatSelect.value;
    state.settings.customTemplate = customTemplateTextarea.value;
    state.settings.defaultUrl = defaultUrlInput.value;
    state.settings.enableRedirectToDefault = enableRTDCheckbox.checked;
    await window.api.redirect.saveSettings(state.settings);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function is410(fmt) {
    return ['apache-redirect-410','apache-rewrite-rule-gone','nginx-return-410'].includes(fmt);
}
function toggleCustomTemplate() {
    customTemplateGroup.style.display = formatSelect.value === 'custom' ? 'block' : 'none';
}
function toggleRTDMode() {
    redirectToDefaultGroup.style.display = enableRTDCheckbox.checked ? 'block' : 'none';
    updateSelectionUI();
}

// ── Preview ────────────────────────────────────────────────────────────────────
async function updatePreview() {
    const fmt = formatSelect.value;
    const needsNewUrl = !is410(fmt) && fmt !== 'custom';
    const newUrlRow = document.getElementById('preview-new-url');
    const infoEl    = document.getElementById('preview-info');
    const infoTxt   = document.getElementById('preview-info-text');
    const resultEl  = document.getElementById('preview-code-result');

    if (newUrlRow) newUrlRow.style.display = needsNewUrl ? 'flex' : 'none';
    if (infoEl && infoTxt) {
        if (is410(fmt)) {
            infoEl.style.display = 'flex';
            infoTxt.textContent = 'Формат 410 (Gone) — страница удалена. Новый URL не нужен.';
        } else {
            infoEl.style.display = 'none';
        }
    }

    try {
        const rule = await window.api.redirect.generatePreview(
            '/old-page', needsNewUrl ? 'https://example.com/new-page' : '',
            fmt, customTemplateTextarea.value
        );
        if (resultEl) { resultEl.textContent = rule; resultEl.classList.remove('is-error'); }
    } catch (e) {
        if (resultEl) { resultEl.textContent = 'Ошибка: ' + e.message; resultEl.classList.add('is-error'); }
    }
}

// ── Redirect management ───────────────────────────────────────────────────────
function addRedirect(oldUrl = '', newUrl = '') {
    state.redirects.push({ oldUrl: String(oldUrl), newUrl: String(newUrl), selected: false, redirectToDefault: false });
    renderTable();
}

function removeRedirect(idx) { state.redirects.splice(idx, 1); renderTable(); }

function clearAll() {
    if (!state.redirects.length) return;
    if (confirm('Удалить все редиректы?')) { state.redirects = []; renderTable(); }
}

function selectAll(checked) { state.redirects.forEach(r => r.selected = checked); renderTable(); }

function redirectSelectedToDefault() {
    state.redirects.filter(r => r.selected).forEach(r => {
        r.redirectToDefault = true; r.newUrl = ''; r.selected = false;
    });
    renderTable();
}

// ── Table render ──────────────────────────────────────────────────────────────
function renderTable() {
    redirectsTbody.innerHTML = '';
    state.redirects.forEach((redir, i) => {
        const tr = document.createElement('tr');
        if (redir.selected) tr.classList.add('selected');

        // Checkbox
        const tdCb = document.createElement('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.className = 'md-checkbox'; cb.checked = redir.selected;
        cb.addEventListener('change', e => { redir.selected = e.target.checked; updateSelectionUI(); });
        tdCb.appendChild(cb);

        // Old URL
        const tdOld = document.createElement('td');
        const inpOld = document.createElement('input');
        inpOld.type = 'text'; inpOld.className = 'table-input'; inpOld.value = redir.oldUrl;
        inpOld.placeholder = 'https://example.com/old или /old-page';
        inpOld.addEventListener('input', e => redir.oldUrl = e.target.value);
        tdOld.appendChild(inpOld);

        // New URL
        const tdNew = document.createElement('td');
        const inpNew = document.createElement('input');
        inpNew.type = 'text'; inpNew.className = 'table-input'; inpNew.value = redir.newUrl;
        inpNew.placeholder = 'https://example.com/new-page';
        inpNew.disabled = redir.redirectToDefault;
        inpNew.addEventListener('input', e => redir.newUrl = e.target.value);
        tdNew.appendChild(inpNew);

        // Delete
        const tdDel = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'table-delete-btn';
        delBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">delete</span>';
        delBtn.addEventListener('click', () => removeRedirect(i));
        tdDel.appendChild(delBtn);

        tr.appendChild(tdCb); tr.appendChild(tdOld); tr.appendChild(tdNew); tr.appendChild(tdDel);
        redirectsTbody.appendChild(tr);
    });
    redirectCount.textContent = state.redirects.length;
    updateSelectionUI();
}

function updateSelectionUI() {
    const sel = state.redirects.filter(r => r.selected).length;
    const all = state.redirects.length;
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = all > 0 && sel === all;
        selectAllCheckbox.indeterminate = sel > 0 && sel < all;
    }
    if (redirectSelectedBtn) {
        const rtdOn = enableRTDCheckbox?.checked;
        redirectSelectedBtn.disabled = !rtdOn || sel === 0;
        redirectSelectedBtn.innerHTML = `<span class="material-symbols-outlined">home</span> Редирект выделенных${sel > 0 ? ' (' + sel + ')' : ''}`;
    }
}

// ── Generate rules ────────────────────────────────────────────────────────────
async function generateRules() {
    const valid = state.redirects.filter(r => r.oldUrl?.trim());
    if (!valid.length) {
        resultsTextarea.value = 'Нет редиректов для генерации. Добавьте хотя бы один старый URL.';
        return;
    }
    try {
        const r = await window.api.redirect.generateRules(
            valid, state.settings.format, state.settings.defaultUrl, state.settings.customTemplate
        );
        if (r.success) {
            resultsTextarea.value = r.rules.map(x => x.rule).join('\n');
        } else {
            resultsTextarea.value = 'Ошибка: ' + r.error;
        }
    } catch (e) {
        resultsTextarea.value = 'Ошибка генерации: ' + e.message;
    }
}

// ── Copy / Clear results ──────────────────────────────────────────────────────
function copyResults() {
    if (!resultsTextarea.value.trim()) { showToast('Нет данных для копирования', 'error'); return; }
    navigator.clipboard.writeText(resultsTextarea.value);
    const orig = copyResultsBtn.innerHTML;
    copyResultsBtn.innerHTML = '<span class="material-symbols-outlined">check</span> Скопировано!';
    setTimeout(() => copyResultsBtn.innerHTML = orig, 2000);
}

// ── Paste mode ────────────────────────────────────────────────────────────────
function switchMode(mode) {
    modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    editMode.classList.toggle('active', mode === 'edit');
    pasteMode.classList.toggle('active', mode === 'paste');
    if (mode === 'paste') { initPasteTable(); setTimeout(() => pasteTbody.querySelector('.paste-cell')?.focus(), 80); }
}

function initPasteTable() {
    if (!pasteTbody.children.length) addPasteRow();
}

function addPasteRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td contenteditable="true" class="paste-cell" data-col="oldUrl"></td>
                    <td contenteditable="true" class="paste-cell" data-col="newUrl"></td>`;
    pasteTbody.appendChild(tr);
    updatePasteCount();
}

function updatePasteCount() {
    const rows = Array.from(pasteTbody.querySelectorAll('tr'));
    pasteCount.textContent = rows.filter(r => {
        const cells = r.querySelectorAll('.paste-cell');
        return cells[0]?.textContent.trim() || cells[1]?.textContent.trim();
    }).length;
}

function escHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function handlePaste(e) {
    e.preventDefault();
    const raw = (e.clipboardData || window.clipboardData).getData('text');
    if (!raw?.trim()) return;
    const hasTab = raw.includes('\t');
    const rows = raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const parts = hasTab ? l.split('\t') : (l.split(/\s{2,}/).length > 1 ? l.split(/\s{2,}/) : [l,'']);
        return { oldUrl: (parts[0]||'').trim(), newUrl: (parts[1]||'').trim() };
    }).filter(r => r.oldUrl);
    if (!rows.length) return;
    pasteTbody.innerHTML = '';
    rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td contenteditable="true" class="paste-cell">${escHtml(row.oldUrl)}</td>
                        <td contenteditable="true" class="paste-cell">${escHtml(row.newUrl)}</td>`;
        pasteTbody.appendChild(tr);
    });
    addPasteRow();
    updatePasteCount();
    pasteTableContainer.scrollTop = 0;
}

function handlePasteKeydown(e) {
    const cell = e.target;
    if (!cell.classList.contains('paste-cell')) return;
    const row = cell.parentElement;
    const cells = Array.from(row.querySelectorAll('.paste-cell'));
    const ci = cells.indexOf(cell);
    const rows = Array.from(pasteTbody.querySelectorAll('tr'));
    const ri = rows.indexOf(row);
    if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
            ci > 0 ? cells[ci-1].focus() : ri > 0 && Array.from(rows[ri-1].querySelectorAll('.paste-cell')).at(-1)?.focus();
        } else {
            if (ci < cells.length-1) cells[ci+1].focus();
            else if (ri < rows.length-1) rows[ri+1].querySelector('.paste-cell')?.focus();
            else { addPasteRow(); rows[rows.length-1].nextSibling?.querySelector?.('.paste-cell')?.focus(); }
        }
    } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (ri < rows.length-1) rows[ri+1].querySelectorAll('.paste-cell')[ci]?.focus();
        else { addPasteRow(); setTimeout(() => pasteTbody.lastChild?.querySelectorAll('.paste-cell')[ci]?.focus(), 10); }
    }
}

function applyPasteData() {
    const newRedirects = Array.from(pasteTbody.querySelectorAll('tr')).map(row => {
        const cells = row.querySelectorAll('.paste-cell');
        return { oldUrl: (cells[0]?.textContent||'').trim(), newUrl: (cells[1]?.textContent||'').trim(), selected: false, redirectToDefault: false };
    }).filter(r => r.oldUrl);
    if (!newRedirects.length) { showToast('Нет данных для добавления', 'error'); return; }
    state.redirects = [...state.redirects, ...newRedirects];
    renderTable();
    switchMode('edit');
    showToast(`Добавлено ${newRedirects.length} редиректов`);
}

// ── Import Excel ──────────────────────────────────────────────────────────────
async function importExcel() {
    try {
        const r = await window.api.redirect.importExcel();
        if (r.success && r.data) {
            let added = 0;
            r.data.forEach(row => {
                const old = String(row['Старый URL'] || row[0] || '').trim();
                const nw  = String(row['Новый URL']  || row[1] || '').trim();
                if (old) { addRedirect(old, nw); added++; }
            });
            added ? showToast(`Импортировано ${added} редиректов`) : showToast('Данные не найдены', 'error');
        } else {
            showToast(r.error || 'Ошибка импорта', 'error');
        }
    } catch (e) { showToast('Ошибка: ' + e.message, 'error'); }
}

// ── Event listeners ───────────────────────────────────────────────────────────
function setupListeners() {
    addRedirectBtn?.addEventListener('click', () => addRedirect());
    importExcelBtn?.addEventListener('click', importExcel);
    clearAllBtn?.addEventListener('click', clearAll);
    redirectSelectedBtn?.addEventListener('click', redirectSelectedToDefault);
    selectAllCheckbox?.addEventListener('change', e => selectAll(e.target.checked));
    generateBtn?.addEventListener('click', generateRules);
    copyResultsBtn?.addEventListener('click', copyResults);
    clearResultsBtn?.addEventListener('click', () => { resultsTextarea.value = ''; });

    formatSelect?.addEventListener('change', async () => { toggleCustomTemplate(); await updatePreview(); saveSettings(); });
    customTemplateTextarea?.addEventListener('input', async () => { await updatePreview(); saveSettings(); });
    defaultUrlInput?.addEventListener('input', () => saveSettings());
    enableRTDCheckbox?.addEventListener('change', () => { toggleRTDMode(); saveSettings(); });

    // Mode tabs
    modeTabs.forEach(t => t.addEventListener('click', () => switchMode(t.dataset.mode)));
    applyPasteBtn?.addEventListener('click', applyPasteData);
    clearPasteBtn?.addEventListener('click', () => { pasteTbody.innerHTML = ''; initPasteTable(); updatePasteCount(); });

    // Paste handling
    document.addEventListener('paste', e => { if (pasteMode.classList.contains('active')) handlePaste(e); });
    pasteTableContainer?.addEventListener('keydown', handlePasteKeydown);
    pasteTbody?.addEventListener('input', updatePasteCount);
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();

})();

/* ── Live Redirect Chain Checker ─────────────────────────────────────── */
(function () {
    const checkerInput = document.getElementById('checker-url-input');
    const checkerBtn   = document.getElementById('checker-run-btn');
    const chainResult  = document.getElementById('checker-chain-result');

    if (!checkerBtn) return;

    async function runChecker(url) {
        if (!url) return;
        chainResult.innerHTML = '<div style="color:var(--md-sys-color-outline);font-size:12px;padding:4px 0">Проверяю...</div>';
        checkerBtn.disabled = true;
        checkerBtn.querySelector('.material-symbols-outlined').textContent = 'sync';
        checkerBtn.querySelector('.material-symbols-outlined').classList.add('spin');

        try {
            const res = await window.api.redirect.checkChain(url);
            chainResult.innerHTML = '';

            if (!res.success) {
                chainResult.innerHTML = `<div style="color:#f87171;font-size:12px">${res.error}</div>`;
                return;
            }

            res.chain.forEach((step, i) => {
                const div = document.createElement('div');
                div.className = 'chain-step';

                let codeClass = 'chain-step__code--3xx';
                if (step.status >= 200 && step.status < 300) codeClass = 'chain-step__code--2xx';
                if (step.status >= 400 || step.status === 0) codeClass = 'chain-step__code--4xx';

                const codeText = step.error ? '✗' : (step.status || '?');
                const arrow = i < res.chain.length - 1
                    ? '<span class="material-symbols-outlined chain-step__arrow" style="font-size:14px">arrow_downward</span>' : '';
                const msText = step.ms ? `<span style="font-size:10px;color:var(--md-sys-color-outline)">${step.ms}ms</span>` : '';

                div.innerHTML = `
                    <span class="chain-step__code ${codeClass}">${codeText}</span>
                    <span class="chain-step__url">${step.error || step.url}</span>
                    ${msText}
                `;
                chainResult.appendChild(div);
                if (arrow) {
                    const a = document.createElement('div');
                    a.innerHTML = arrow;
                    a.style.paddingLeft = '8px';
                    chainResult.appendChild(a);
                }
            });

            const last = res.chain[res.chain.length - 1];
            if (last?.status >= 200 && last?.status < 300) {
                const ok = document.createElement('div');
                ok.style.cssText = 'font-size:11px;color:#4ade80;padding:4px 0';
                ok.textContent = `✓ Конечный URL: ${last.url}`;
                chainResult.appendChild(ok);
            }
        } catch(e) {
            chainResult.innerHTML = `<div style="color:#f87171;font-size:12px">Ошибка: ${e.message}</div>`;
        } finally {
            checkerBtn.disabled = false;
            const ico = checkerBtn.querySelector('.material-symbols-outlined');
            ico.textContent = 'play_arrow';
            ico.classList.remove('spin');
        }
    }

    checkerBtn.addEventListener('click', () => runChecker(checkerInput.value.trim()));
    checkerInput.addEventListener('keydown', e => { if (e.key === 'Enter') runChecker(checkerInput.value.trim()); });
})();
