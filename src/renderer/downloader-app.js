/* ── Image Downloader renderer ───────────────────────────────────────── */
(function () {
    if (!document.getElementById('panel-downloader')) return;

    const $  = id => document.getElementById(id);

    const urlsArea   = $('dl-urls');
    const outputDir  = $('dl-output-dir');
    const browseBtn  = $('dl-browse-btn');
    const runBtn     = $('dl-run-btn');
    const openBtn    = $('dl-open-folder-btn');
    const clearBtn   = $('dl-clear-btn');
    const queueList  = $('dl-queue-list');
    const totalCount = $('dl-total-count');
    const statDone   = $('dl-stat-done');
    const statError  = $('dl-stat-error');
    const statSize   = $('dl-stat-size');
    const progressFill = $('dl-progress-fill');

    let currentDir = null;
    let totalUrls  = 0;
    let doneCount  = 0;
    let errCount   = 0;
    let totalBytes = 0;
    const itemMap  = {};

    function formatBytes(bytes) {
        if (!bytes) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    function updateStats() {
        statDone.textContent  = doneCount;
        statError.textContent = errCount;
        statSize.textContent  = formatBytes(totalBytes);
        if (totalUrls > 0) {
            const pct = Math.round((doneCount + errCount) / totalUrls * 100);
            progressFill.style.width = pct + '%';
        }
    }

    // ── Выбор папки ──────────────────────────────────────────────────
    browseBtn?.addEventListener('click', async () => {
        const dir = await window.api.downloader.selectFolder();
        if (dir) { currentDir = dir; outputDir.value = dir; }
    });

    // ── Очистить ─────────────────────────────────────────────────────
    clearBtn?.addEventListener('click', () => {
        queueList.innerHTML = `<div class="empty-state">
            <span class="material-symbols-outlined">photo_library</span>
            <div class="empty-state__title">Вставьте URL картинок</div>
        </div>`;
        doneCount = errCount = totalBytes = totalUrls = 0;
        updateStats();
        openBtn.disabled = true;
    });

    // ── Предпросмотр очереди при вводе URL ───────────────────────────
    urlsArea?.addEventListener('input', () => {
        const urls = urlsArea.value.split('\n').map(u => u.trim()).filter(Boolean);
        totalCount.textContent = urls.length
            ? `${urls.length} URL готово к загрузке`
            : 'Добавьте URL для начала';
    });

    // ── Прогресс ─────────────────────────────────────────────────────
    window.api.downloader.onProgress((item) => {
        let el = itemMap[item.url];
        if (!el) {
            el = document.createElement('div');
            el.className = 'dl-item dl-item--pending';
            el.dataset.url = item.url;
            el.innerHTML = `
                <span class="material-symbols-outlined dl-item__icon">schedule</span>
                <span class="dl-item__url" title="${item.url}">${item.url}</span>
                <span class="dl-item__size">—</span>`;
            itemMap[item.url] = el;
            if (queueList.querySelector('.empty-state')) queueList.innerHTML = '';
            queueList.appendChild(el);
        }

        el.className = `dl-item dl-item--${item.status}`;
        const iconEl = el.querySelector('.dl-item__icon');
        const sizeEl = el.querySelector('.dl-item__size');

        if (item.status === 'done') {
            iconEl.textContent = 'check_circle';
            sizeEl.textContent = formatBytes(item.size);
            doneCount++;
            totalBytes += item.size || 0;
        } else if (item.status === 'error') {
            iconEl.textContent = 'error';
            sizeEl.textContent = item.error || 'Ошибка';
            errCount++;
            el.title = item.error;
        } else if (item.status === 'skipped') {
            iconEl.textContent = 'skip_next';
            sizeEl.textContent = 'пропущен';
            doneCount++;
        }
        updateStats();
    });

    // ── Скачать ──────────────────────────────────────────────────────
    runBtn?.addEventListener('click', async () => {
        const urls = urlsArea.value.split('\n').map(u => u.trim()).filter(Boolean);
        if (!urls.length) { showToast('Введите URL изображений', 'warning'); return; }
        if (!currentDir) { showToast('Выберите папку для сохранения', 'warning'); return; }

        // Reset
        queueList.innerHTML = '';
        Object.keys(itemMap).forEach(k => delete itemMap[k]);
        doneCount = errCount = totalBytes = 0;
        totalUrls = urls.length;
        updateStats();

        const structure   = document.querySelector('input[name="dl-structure"]:checked')?.value || 'domain-path';
        const concurrency = parseInt($('dl-concurrency')?.value) || 3;
        const skipExisting= $('dl-skip-existing')?.checked ?? true;

        runBtn.disabled = true;
        runBtn.innerHTML = '<span class="material-symbols-outlined spin">sync</span> Скачивание...';

        totalCount.textContent = `Скачивание ${urls.length} файлов...`;

        const res = await window.api.downloader.download(urls, currentDir, { structure, concurrency, skipExisting });

        runBtn.disabled = false;
        runBtn.innerHTML = '<span class="material-symbols-outlined">download</span> Скачать изображения';
        openBtn.disabled = false;

        if (res.success) {
            showToast(`Готово! ${doneCount} файлов, ${formatBytes(totalBytes)}`, 'success');
            totalCount.textContent = `Завершено: ${doneCount} ✓  ${errCount} ✗`;
        } else {
            showToast(res.error || 'Ошибка', 'error');
        }
    });

    // ── Открыть папку ─────────────────────────────────────────────────
    openBtn?.addEventListener('click', () => {
        if (currentDir) window.api.downloader.openFolder(currentDir);
    });
})();
