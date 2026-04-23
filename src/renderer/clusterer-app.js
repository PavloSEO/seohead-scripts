/* ── Keyword Clusterer renderer ─────────────────────────────────────── */
(function () {
    if (!document.getElementById('panel-clusterer')) return;

    const $  = id => document.getElementById(id);

    const pyBanner   = $('py-status-banner');
    const browseBtn  = $('cl-browse-btn');
    const fileInput  = $('cl-file-path');
    const runBtn     = $('cl-run-btn');
    const saveBtn    = $('cl-save-btn');
    const resultList = $('cl-result-list');
    const statsLabel = $('cl-stats-label');
    const expandBtn  = $('cl-expand-all-btn');
    const methodSel  = $('cl-method');
    const kGroup     = $('cl-k-group');
    const kAuto      = $('cl-k-auto');
    const kValue     = $('cl-k-value');

    let pythonCmd  = 'python3';
    let filePath   = null;
    let lastClusters = [];

    // ── Проверка Python ──────────────────────────────────────────────
    async function checkPython() {
        const res = await window.api.clusterer.checkPython();
        pyBanner.className = 'py-banner';
        if (res.found) {
            pythonCmd = res.cmd;
            pyBanner.classList.add('py-banner--ok');
            pyBanner.innerHTML = `<span class="material-symbols-outlined">check_circle</span>
                <span>${res.version} найден (${res.cmd})</span>`;
        } else {
            pyBanner.classList.add('py-banner--error');
            pyBanner.innerHTML = `<span class="material-symbols-outlined">error</span>
                <span>Python не найден. Установите Python 3.8+ и scikit-learn:<br>
                <code style="font-size:11px">pip install scikit-learn numpy</code></span>`;
            runBtn.disabled = true;
        }
    }
    checkPython();

    // ── Метод кластеризации → показать/скрыть K ──────────────────────
    methodSel?.addEventListener('change', () => {
        kGroup.style.display = methodSel.value === 'dbscan' ? 'none' : 'block';
    });

    kAuto?.addEventListener('change', () => {
        kValue.disabled = kAuto.checked;
    });

    // ── Выбор файла ──────────────────────────────────────────────────
    browseBtn?.addEventListener('click', async () => {
        const fp = await window.api.clusterer.selectFile();
        if (fp) { filePath = fp; fileInput.value = fp; }
    });

    // ── Логи ─────────────────────────────────────────────────────────
    window.api.clusterer.onLog((data) => {
        const colMap = { warn: '#fbbf24', error: '#f87171', ok: '#4ade80' };
        statsLabel.textContent = data.msg;
        statsLabel.style.color = colMap[data.level] || '';
    });

    // ── Рендер кластеров ─────────────────────────────────────────────
    function renderClusters(clusters) {
        resultList.innerHTML = '';
        expandBtn.style.display = 'inline-flex';
        let expanded = false;

        clusters.forEach((cl) => {
            const group = document.createElement('div');
            group.className = 'cluster-group';

            const head = document.createElement('div');
            head.className = 'cluster-group__head';
            head.innerHTML = `
                <div class="cluster-num">${cl.id}</div>
                <span class="cluster-name">${cl.name}</span>
                <span class="cluster-count">${cl.count} ключей</span>
                <span class="material-symbols-outlined" style="font-size:18px;color:var(--md-sys-color-outline)">expand_more</span>`;

            const body = document.createElement('div');
            body.className = 'cluster-group__body';
            body.style.display = 'none';
            cl.keywords.forEach(kw => {
                const chip = document.createElement('span');
                chip.className = 'kw-chip';
                chip.textContent = kw;
                body.appendChild(chip);
            });

            head.addEventListener('click', () => {
                const isOpen = body.style.display !== 'none';
                body.style.display = isOpen ? 'none' : 'flex';
                head.querySelector('.material-symbols-outlined').textContent = isOpen ? 'expand_more' : 'expand_less';
                group.classList.toggle('expanded', !isOpen);
            });

            group.appendChild(head);
            group.appendChild(body);
            resultList.appendChild(group);
        });

        expandBtn?.addEventListener('click', () => {
            expanded = !expanded;
            resultList.querySelectorAll('.cluster-group__body').forEach(b => {
                b.style.display = expanded ? 'flex' : 'none';
            });
            resultList.querySelectorAll('.cluster-group__head .material-symbols-outlined').forEach(i => {
                i.textContent = expanded ? 'expand_less' : 'expand_more';
            });
            expandBtn.innerHTML = expanded
                ? '<span class="material-symbols-outlined">unfold_less</span> Свернуть все'
                : '<span class="material-symbols-outlined">unfold_more</span> Развернуть все';
        });
    }

    // ── Запуск ───────────────────────────────────────────────────────
    runBtn?.addEventListener('click', async () => {
        if (!filePath) { showToast('Выберите файл с ключами', 'warning'); return; }

        resultList.innerHTML = `<div class="empty-state">
            <span class="material-symbols-outlined spin" style="font-size:36px">hub</span>
            <div class="empty-state__title">Кластеризация...</div>
        </div>`;
        saveBtn.disabled = true;
        expandBtn.style.display = 'none';
        runBtn.disabled = true;
        runBtn.innerHTML = '<span class="material-symbols-outlined spin">hub</span> Обработка...';

        const params = {
            filepath:     filePath,
            method:       methodSel?.value || 'kmeans',
            k:            parseInt(kValue?.value) || 20,
            auto_k:       kAuto?.checked,
            language:     $('cl-language')?.value || 'russian',
            stem:         $('cl-stem')?.checked ?? true,
            stopwords:    $('cl-stopwords')?.checked ?? true,
            max_features: parseInt($('cl-features')?.value) || 10000,
            pythonCmd
        };

        const res = await window.api.clusterer.run(params);

        runBtn.disabled = false;
        runBtn.innerHTML = '<span class="material-symbols-outlined">hub</span> Кластеризовать';

        if (res.error) {
            resultList.innerHTML = `<div class="empty-state">
                <span class="material-symbols-outlined" style="color:#f87171">error</span>
                <div class="empty-state__title" style="color:#f87171">Ошибка</div>
                <div class="empty-state__sub">${res.error}</div>
            </div>`;
            showToast('Ошибка кластеризации', 'error');
            return;
        }

        lastClusters = res.clusters || [];
        statsLabel.textContent = `${res.total_keywords} ключей → ${res.total_clusters} кластеров`;
        statsLabel.style.color = '';
        renderClusters(lastClusters);
        saveBtn.disabled = false;
        showToast(`${res.total_clusters} кластеров готово!`, 'success');
    });

    // ── Сохранить ─────────────────────────────────────────────────────
    saveBtn?.addEventListener('click', async () => {
        const fmt = document.querySelector('input[name="cl-output"]:checked')?.value || 'csv';
        const res = await window.api.clusterer.saveResult(lastClusters, fmt);
        if (res.success) showToast(`Сохранено: ${res.filePath}`, 'success');
        else showToast(res.error, 'error');
    });
})();
