/* ── SEO Parser renderer ──────────────────────────────────────────────── */
(function () {
    if (!document.getElementById('panel-parser')) return;

    const $  = id => document.getElementById(id);
    const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

    const runBtn     = $('parser-run-btn');
    const saveBtn    = $('parser-save-btn');
    const urlsArea   = $('parser-urls');
    const cardsList  = $('parser-cards-list');
    const logArea    = $('parser-log-area');
    const mdPreview  = $('parser-md-preview');
    const copyMdBtn  = $('parser-copy-md-btn');

    let allResults = [];

    // ── UA кастомный ──────────────────────────────────────────────────
    document.getElementById('parser-ua')?.addEventListener('change', function () {
        const custom = document.getElementById('parser-ua-custom');
        if (custom) custom.style.display = this.value === 'custom' ? 'block' : 'none';
    });

    // ── Лог ──────────────────────────────────────────────────────────
    function addLog(msg, level = 'info') {
        const line = document.createElement('div');
        line.className = `log-${level}`;
        line.textContent = `[${new Date().toLocaleTimeString('ru-RU')}] ${msg}`;
        logArea.appendChild(line);
        logArea.scrollTop = logArea.scrollHeight;
    }

    // ── Карточка результата ───────────────────────────────────────────
    function renderCard(res) {
        const card = el('div', 'parser-card');

        if (!res.success) {
            card.innerHTML = `
                <div class="parser-card__head">
                    <span class="parser-card__url">${res.url}</span>
                    <span class="parser-card__status chip chip--error">Ошибка</span>
                </div>
                <div class="parser-card__body" style="display:block;color:#f87171">${res.error}</div>`;
            card.classList.add('expanded');
            return card;
        }

        const d = res.data;
        const status = d.status;
        const statusCls = status >= 200 && status < 300 ? 'chip--success' : 'chip--error';

        const head = el('div', 'parser-card__head');
        head.innerHTML = `
            <span class="parser-card__url">${d.url}</span>
            <span class="parser-card__status chip ${statusCls}">${status}</span>
            <span class="material-symbols-outlined parser-card__toggle">expand_more</span>`;
        head.addEventListener('click', () => card.classList.toggle('expanded'));

        const body = el('div', 'parser-card__body');
        const rows = [];
        if (d.title)       rows.push(['Title',       d.title]);
        if (d.description) rows.push(['Description', d.description]);
        if (d.canonical)   rows.push(['Canonical',   d.canonical]);
        if (d.robots)      rows.push(['Robots',      d.robots]);
        if (d.lang)        rows.push(['Lang',        d.lang]);

        const h1 = d.headings?.h1?.[0];
        if (h1)            rows.push(['H1',          h1]);

        const metaHtml = `<div class="meta-grid">${rows.map(([k,v]) =>
            `<span class="meta-key">${k}</span><span class="meta-val">${v}</span>`
        ).join('')}</div>`;

        // OG
        let ogHtml = '';
        if (d.og && Object.keys(d.og).length) {
            ogHtml = `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:var(--md-sys-color-on-surface-variant)">Open Graph (${Object.keys(d.og).length})</summary>
                <div class="meta-grid" style="margin-top:6px">${Object.entries(d.og).map(([k,v]) =>
                    `<span class="meta-key">${k}</span><span class="meta-val">${v}</span>`
                ).join('')}</div></details>`;
        }

        // Links
        let linksHtml = '';
        if (d.links) {
            linksHtml = `<div style="margin-top:8px;font-size:12px;color:var(--md-sys-color-on-surface-variant)">
                Ссылок: <b style="color:var(--tab-accent)">${d.links.internal.length}</b> внутренних,
                <b style="color:var(--tab-accent)">${d.links.external.length}</b> внешних
            </div>`;
        }

        body.innerHTML = metaHtml + ogHtml + linksHtml;
        card.appendChild(head);
        card.appendChild(body);
        return card;
    }

    // ── Прогресс ─────────────────────────────────────────────────────
    window.api.parser.onProgress((data) => {
        if (data.type === 'start') {
            addLog(`Парсинг [${data.index + 1}/${data.total}]: ${data.url}`);
        } else if (data.type === 'done') {
            const card = renderCard(data.result);
            if (cardsList.querySelector('.empty-state')) cardsList.innerHTML = '';
            cardsList.appendChild(card);
            addLog(data.result.success
                ? `✓ ${data.url} — ${data.result.data?.status}`
                : `✗ ${data.url} — ${data.result.error}`, data.result.success ? 'ok' : 'err');
        }
    });

    // ── Запуск ───────────────────────────────────────────────────────
    runBtn?.addEventListener('click', async () => {
        const urls = urlsArea.value.split('\n').map(u => u.trim()).filter(Boolean);
        if (!urls.length) { showToast('Введите хотя бы один URL', 'warning'); return; }

        cardsList.innerHTML = '';
        logArea.innerHTML   = '';
        mdPreview.textContent = '';
        allResults          = [];
        saveBtn.disabled    = true;

        const outputMode = document.querySelector('input[name="parser-output"]:checked')?.value || 'single';
        const ua         = document.getElementById('parser-ua')?.value || 'chrome';
        const customUa   = ua === 'custom' ? document.getElementById('parser-ua-value')?.value : null;
        const delay      = parseInt(document.getElementById('parser-delay')?.value) || 0;

        const opts = {
            ua, customUa, delay,
            meta:     $('pex-meta')?.checked,
            og:       $('pex-og')?.checked,
            headings: $('pex-headings')?.checked,
            canonical:$('pex-canonical')?.checked,
            jsonld:   $('pex-jsonld')?.checked,
            links:    $('pex-links')?.checked,
            text:     $('pex-text')?.checked,
            images:   $('pex-images')?.checked,
        };

        runBtn.disabled = true;
        runBtn.innerHTML = '<span class="material-symbols-outlined spin">sync</span> Парсинг...';

        addLog(`Запуск парсинга ${urls.length} URL...`, 'info');

        try {
            const res = await window.api.parser.parseUrls(urls, opts);
            allResults = res.results;

            // Строим MD
            const mdParts = allResults.filter(r => r.success).map(r => r.data.md);
            const fullMd  = mdParts.join('\n\n---\n\n');
            mdPreview.textContent = fullMd;

            const ok  = allResults.filter(r => r.success).length;
            const err = allResults.filter(r => !r.success).length;
            addLog(`Готово! ${ok} успешно, ${err} ошибок`, ok > 0 ? 'ok' : 'err');
            if (ok > 0) saveBtn.disabled = false;
            showToast(`Обработано ${ok} URL`, 'success');
        } catch(e) {
            addLog(`Критическая ошибка: ${e.message}`, 'err');
            showToast('Ошибка парсинга', 'error');
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span> Запустить парсинг';
        }
    });

    // ── Сохранить MD ─────────────────────────────────────────────────
    saveBtn?.addEventListener('click', async () => {
        const outputMode = document.querySelector('input[name="parser-output"]:checked')?.value || 'single';
        let content;
        if (outputMode === 'single') {
            content = allResults.filter(r => r.success).map(r => r.data.md).join('\n\n---\n\n');
        } else {
            content = allResults.filter(r => r.success).map(r => ({ url: r.data.url, md: r.data.md }));
        }
        const res = await window.api.parser.saveMarkdown(content, outputMode);
        if (res.success) showToast('MD файл(ы) сохранены!', 'success');
        else showToast(res.error, 'error');
    });

    // ── Копировать MD ─────────────────────────────────────────────────
    copyMdBtn?.addEventListener('click', () => {
        const text = mdPreview.textContent;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => showToast('MD скопирован!', 'success'));
    });
})();
