/* ═══════════════════════════════════════════════════════════════════════════
   Sitemap Analyser — renderer logic
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* ── State ─────────────────────────────────────────────────────────────── */
    let crawlResult   = null;   // { sitemaps, urls, errors }
    let treeRoot      = null;   // built tree node
    let isCrawling    = false;

    /* ── DOM refs ──────────────────────────────────────────────────────────── */
    const $ = id => document.getElementById(id);

    const urlInput        = $('sm-url-input');
    const runBtn          = $('sm-run-btn');
    const stopBtn         = $('sm-stop-btn');
    const concurrencyEl   = $('sm-concurrency');
    const concurrencyVal  = $('sm-concurrency-val');
    const leafThresholdEl = $('sm-leaf-threshold');
    const leafThresholdV  = $('sm-leaf-threshold-val');
    const autoDepthEl     = $('sm-auto-depth');
    const autoDepthVal    = $('sm-auto-depth-val');
    const redrawBtn       = $('sm-redraw-btn');
    const treeRoot_el     = $('sm-tree-root');
    const logArea         = $('sm-log-area');
    const expandAllBtn    = $('sm-expand-all-btn');
    const collapseAllBtn  = $('sm-collapse-all-btn');
    const treeSearch      = $('sm-tree-search');
    const exportMdBtn     = $('sm-export-md-btn');
    const exportJsonBtn   = $('sm-export-json-btn');
    const exportPngBtn    = $('sm-export-png-btn');
    const sitemapsTbody   = $('sm-sitemaps-tbody');
    const infoPanel       = $('sm-info-panel');

    const mindmapCanvas    = $('sm-mindmap-canvas');
    const mindmapHost      = $('sm-mindmap-host');
    const mindmapRedrawBtn = $('sm-mindmap-redraw');
    const mindmapDepthEl   = $('sm-mindmap-depth');
    const mindmapDepthVal  = $('sm-mindmap-depth-val');
    const mindmapHint      = $('sm-mindmap-hint');

    const statSitemaps = $('sm-stat-sitemaps');
    const statUrls     = $('sm-stat-urls');
    const statErrors   = $('sm-stat-errors');
    const statDepth    = $('sm-stat-depth');

    /* ── Pane switcher ─────────────────────────────────────────────────────── */
    document.querySelectorAll('[data-sm-pane]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-sm-pane]').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.sm-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const pane = $(btn.dataset.smPane);
            if (pane) pane.classList.add('active');
            if (btn.dataset.smPane === 'sm-pane-mindmap') scheduleMindmapDraw();
        });
    });

    /* ── Range labels ──────────────────────────────────────────────────────── */
    concurrencyEl.addEventListener('input', () => { concurrencyVal.textContent = concurrencyEl.value; });
    leafThresholdEl.addEventListener('input', () => { leafThresholdV.textContent = leafThresholdEl.value; });
    autoDepthEl.addEventListener('input', () => { autoDepthVal.textContent = autoDepthEl.value; });
    mindmapDepthEl.addEventListener('input', () => {
        mindmapDepthVal.textContent = mindmapDepthEl.value;
        scheduleMindmapDraw();
    });

    /* ── Log helpers ───────────────────────────────────────────────────────── */
    function appendLog(msg, type = 'info') {
        const line = document.createElement('div');
        line.className = `log-line log-line--${type}`;
        const icons = { info: 'info', success: 'check_circle', warn: 'warning', error: 'error' };
        line.innerHTML = `<span class="material-symbols-outlined log-icon">${icons[type] || 'info'}</span>
                          <span class="log-text">${escHtml(msg)}</span>`;
        logArea.appendChild(line);
        logArea.scrollTop = logArea.scrollHeight;
    }

    function escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    /* ── Stats update ──────────────────────────────────────────────────────── */
    function updateStats(sitemaps, urls, errors) {
        statSitemaps.textContent = sitemaps.length;
        statUrls.textContent     = urls.length.toLocaleString('ru');
        statErrors.textContent   = errors.length;
        statDepth.textContent    = treeRoot ? maxDepth(treeRoot) : '—';
    }

    function maxDepth(node) {
        if (!node.children || node.children.size === 0) return node.depth || 0;
        let max = 0;
        for (const child of node.children.values()) {
            max = Math.max(max, maxDepth(child));
        }
        return max;
    }

    /* ── Tree builder ──────────────────────────────────────────────────────── */
    function buildTree(urlObjects) {
        const root = { label: '/', path: '/', children: new Map(), leafUrls: [], urlCount: 0, depth: 0 };

        for (const urlObj of urlObjects) {
            let parsed;
            try { parsed = new URL(urlObj.loc); } catch { continue; }

            const segs = parsed.pathname.split('/').filter(Boolean);
            let node = root;
            node.urlCount++;

            if (segs.length === 0) {
                node.leafUrls.push(urlObj);
            } else {
                for (let i = 0; i < segs.length; i++) {
                    const seg = segs[i];
                    if (!node.children.has(seg)) {
                        node.children.set(seg, {
                            label:    seg,
                            path:     '/' + segs.slice(0, i + 1).join('/'),
                            children: new Map(),
                            leafUrls: [],
                            urlCount: 0,
                            depth:    i + 1,
                        });
                    }
                    node = node.children.get(seg);
                    node.urlCount++;
                    if (i === segs.length - 1) node.leafUrls.push(urlObj);
                }
            }
        }

        // Attach domain label
        if (urlObjects.length > 0) {
            try { root.domain = new URL(urlObjects[0].loc).origin; } catch {}
        }
        return root;
    }

    /* ── Tree renderer ─────────────────────────────────────────────────────── */
    const LEAF_THRESHOLD = () => parseInt(leafThresholdEl.value, 10);
    const AUTO_DEPTH     = () => parseInt(autoDepthEl.value,     10);

    function renderNode(node, depth) {
        const hasChildren = node.children && node.children.size > 0;
        const hasLeafs    = node.leafUrls && node.leafUrls.length > 0;
        const isExpandable = hasChildren || hasLeafs;
        const autoExpand   = depth < AUTO_DEPTH();

        const el = document.createElement('div');
        el.className = 'sm-node';
        el.dataset.depth = depth;

        /* header row */
        const header = document.createElement('div');
        header.className = 'sm-node__hdr';
        header.style.paddingLeft = `${depth * 16 + 6}px`;

        /* toggle chevron */
        const toggle = document.createElement('button');
        toggle.className = 'sm-toggle';
        if (!isExpandable) toggle.style.visibility = 'hidden';
        toggle.innerHTML = `<span class="material-symbols-outlined">${(isExpandable && autoExpand) ? 'expand_more' : 'chevron_right'}</span>`;
        header.appendChild(toggle);

        /* icon */
        const icon = document.createElement('span');
        icon.className = `material-symbols-outlined sm-node__icon`;
        if (depth === 0) {
            icon.textContent = 'language';
        } else if (hasChildren) {
            icon.textContent = 'folder';
        } else {
            icon.textContent = 'web_asset';
        }
        header.appendChild(icon);

        /* label */
        const label = document.createElement('span');
        label.className = 'sm-node__label';
        label.textContent = depth === 0
            ? (node.domain || '/')
            : '/' + node.label;
        header.appendChild(label);

        /* count chip */
        const chip = document.createElement('span');
        chip.className = 'sm-node__chip';
        chip.textContent = node.urlCount.toLocaleString('ru');
        header.appendChild(chip);

        el.appendChild(header);

        /* children container */
        if (isExpandable) {
            const body = document.createElement('div');
            body.className = 'sm-node__body';
            body.style.display = autoExpand ? 'block' : 'none';

            /* child sections */
            if (hasChildren) {
                for (const child of node.children.values()) {
                    body.appendChild(renderNode(child, depth + 1));
                }
            }

            /* leaf URLs at this level */
            if (hasLeafs) {
                if (node.leafUrls.length >= LEAF_THRESHOLD()) {
                    /* show counter badge */
                    const counter = document.createElement('div');
                    counter.className = 'sm-leaf-count';
                    counter.style.paddingLeft = `${(depth + 1) * 16 + 6}px`;
                    const sampleBtn = document.createElement('button');
                    sampleBtn.className = 'sm-leaf-expand';
                    sampleBtn.textContent = 'показать первые 10';
                    const sampleList = document.createElement('div');
                    sampleList.className = 'sm-leaf-sample';
                    sampleList.style.display = 'none';
                    let sampleVisible = false;
                    sampleBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        sampleVisible = !sampleVisible;
                        sampleList.style.display = sampleVisible ? 'block' : 'none';
                        sampleBtn.textContent = sampleVisible ? 'скрыть' : 'показать первые 10';
                        if (sampleVisible && !sampleList.children.length) {
                            node.leafUrls.slice(0, 10).forEach(u => {
                                const li = document.createElement('div');
                                li.className = 'sm-leaf-item';
                                li.style.paddingLeft = `${(depth + 2) * 16 + 6}px`;
                                li.innerHTML = `<span class="material-symbols-outlined">article</span><span class="sm-leaf-url">${escHtml(u.loc)}</span>`;
                                sampleList.appendChild(li);
                            });
                        }
                    });
                    counter.innerHTML = `<span class="material-symbols-outlined">article</span>
                        <span class="sm-leaf-count__num">${node.leafUrls.length.toLocaleString('ru')}</span>
                        <span class="sm-leaf-count__lbl"> конечных страниц</span>`;
                    counter.appendChild(sampleBtn);
                    body.appendChild(counter);
                    body.appendChild(sampleList);
                } else {
                    /* show individual items */
                    node.leafUrls.forEach(u => {
                        const li = document.createElement('div');
                        li.className = 'sm-leaf-item';
                        li.style.paddingLeft = `${(depth + 1) * 16 + 6}px`;
                        li.innerHTML = `<span class="material-symbols-outlined">article</span><span class="sm-leaf-url">${escHtml(u.loc)}</span>`;
                        body.appendChild(li);
                    });
                }
            }

            /* toggle click */
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = body.style.display !== 'none';
                body.style.display = open ? 'none' : 'block';
                toggle.querySelector('.material-symbols-outlined').textContent =
                    open ? 'chevron_right' : 'expand_more';
            });

            el.appendChild(body);
        }

        return el;
    }

    function renderTree(root) {
        treeRoot_el.innerHTML = '';
        if (!root) return;
        treeRoot_el.appendChild(renderNode(root, 0));
    }

    /* ── Expand / collapse all ─────────────────────────────────────────────── */
    function setAllExpanded(container, open) {
        container.querySelectorAll('.sm-node__body').forEach(body => {
            body.style.display = open ? 'block' : 'none';
        });
        container.querySelectorAll('.sm-toggle .material-symbols-outlined').forEach(ic => {
            ic.textContent = open ? 'expand_more' : 'chevron_right';
        });
    }

    expandAllBtn.addEventListener('click',  () => setAllExpanded(treeRoot_el, true));
    collapseAllBtn.addEventListener('click', () => setAllExpanded(treeRoot_el, false));

    /* ── Tree search / filter ──────────────────────────────────────────────── */
    let searchTimer = null;
    treeSearch.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => applyFilter(treeSearch.value.trim().toLowerCase()), 200);
    });

    function applyFilter(query) {
        if (!query) {
            treeRoot_el.querySelectorAll('.sm-node').forEach(n => n.style.display = '');
            return;
        }
        treeRoot_el.querySelectorAll('.sm-node').forEach(n => {
            const label = n.querySelector('.sm-node__label')?.textContent.toLowerCase() || '';
            n.style.display = label.includes(query) ? '' : 'none';
        });
    }

    /* ── Progress handler ──────────────────────────────────────────────────── */
    window.api.sitemap.onProgress(p => {
        if (!isCrawling) return;
        switch (p.type) {
            case 'fetching':
                appendLog(`Загружаю: ${p.url}`, 'info');
                break;
            case 'index':
                appendLog(`Index-сайтмап: ${p.url} → ${p.childCount} дочерних`, 'success');
                break;
            case 'urlset':
                statUrls.textContent = p.totalUrls.toLocaleString('ru');
                appendLog(`Urlset: ${p.url} — ${p.urlCount} URL (всего ${p.totalUrls})`, 'success');
                break;
            case 'error':
                appendLog(`Ошибка [${p.url}]: ${p.error}`, 'error');
                break;
        }
    });

    /* ── Run ───────────────────────────────────────────────────────────────── */
    runBtn.addEventListener('click', async () => {
        const rawUrl = urlInput.value.trim();
        if (!rawUrl) { showToast('Введите URL сайтмапа', 'error'); return; }

        // Basic URL validation
        try { new URL(rawUrl); } catch {
            showToast('Неверный URL', 'error');
            return;
        }

        isCrawling = true;
        crawlResult = null;
        treeRoot    = null;

        runBtn.disabled  = true;
        stopBtn.disabled = false;
        exportMdBtn.disabled   = true;
        exportJsonBtn.disabled = true;
        exportPngBtn.disabled  = true;
        expandAllBtn.disabled  = true;
        collapseAllBtn.disabled = true;
        treeSearch.disabled    = true;
        redrawBtn.disabled       = true;
        mindmapRedrawBtn.disabled = true;

        logArea.innerHTML = '';
        treeRoot_el.innerHTML = '<div class="sm-loading"><span class="material-symbols-outlined spin">sync</span> Загрузка…</div>';
        sitemapsTbody.innerHTML = '';
        infoPanel.textContent = 'Анализ…';
        statSitemaps.textContent = statUrls.textContent = statErrors.textContent = statDepth.textContent = '…';

        // Switch to log pane during crawl
        const logTab = document.querySelector('[data-sm-pane="sm-pane-log"]');
        logTab?.click();

        appendLog(`Старт: ${rawUrl}`, 'info');

        const result = await window.api.sitemap.crawl(rawUrl, {
            concurrency: parseInt(concurrencyEl.value, 10),
        });

        isCrawling    = false;
        runBtn.disabled  = false;
        stopBtn.disabled = true;

        if (!result.success) {
            appendLog(`Фатальная ошибка: ${result.error}`, 'error');
            treeRoot_el.innerHTML = `<div class="sm-error"><span class="material-symbols-outlined">error</span>${escHtml(result.error)}</div>`;
            showToast('Ошибка анализа: ' + result.error, 'error');
            return;
        }

        crawlResult = result;
        appendLog(`Готово! Сайтмапов: ${result.sitemaps.length} | URL: ${result.urls.length} | Ошибок: ${result.errors.length}`, 'success');

        // Build & render tree
        treeRoot = buildTree(result.urls);
        renderTree(treeRoot);

        // Fill sitemaps table
        fillSitemapsTable(result.sitemaps);

        // Update stats
        updateStats(result.sitemaps, result.urls, result.errors);
        updateInfoPanel(rawUrl, result);

        // Enable controls
        exportMdBtn.disabled    = false;
        exportJsonBtn.disabled  = false;
        exportPngBtn.disabled   = false;
        expandAllBtn.disabled   = false;
        collapseAllBtn.disabled = false;
        treeSearch.disabled     = false;
        redrawBtn.disabled        = false;
        mindmapRedrawBtn.disabled = false;

        // Switch to tree pane
        document.querySelector('[data-sm-pane="sm-pane-tree"]')?.click();
        showToast(`Готово: ${result.urls.length.toLocaleString('ru')} URL`, 'success');
    });

    /* ── Redraw ────────────────────────────────────────────────────────────── */
    redrawBtn.addEventListener('click', () => {
        if (treeRoot) renderTree(treeRoot);
    });

    /* ── Fill sitemaps table ───────────────────────────────────────────────── */
    function fillSitemapsTable(sitemaps) {
        sitemapsTbody.innerHTML = '';
        sitemaps.forEach(sm => {
            const tr = document.createElement('tr');
            const typeChip = sm.type === 'index'
                ? `<span class="chip" style="background:var(--tab-accent-dim);color:var(--tab-accent)">index</span>`
                : `<span class="chip">urlset</span>`;
            const count = sm.type === 'index'
                ? `${sm.childCount} дочерних`
                : `${sm.urlCount} URL`;
            tr.innerHTML = `
                <td style="word-break:break-all;font-size:11.5px;">${escHtml(sm.url)}</td>
                <td>${typeChip}</td>
                <td>${count}</td>`;
            sitemapsTbody.appendChild(tr);
        });
    }

    /* ── Info panel ────────────────────────────────────────────────────────── */
    function updateInfoPanel(rootUrl, result) {
        const indexCount  = result.sitemaps.filter(s => s.type === 'index').length;
        const urlsetCount = result.sitemaps.filter(s => s.type === 'urlset').length;
        const depth       = treeRoot ? maxDepth(treeRoot) : 0;
        infoPanel.innerHTML = `
            <strong>Корень:</strong><br>
            <span style="word-break:break-all;font-size:11px;">${escHtml(rootUrl)}</span><br><br>
            <strong>Сайтмапы:</strong> ${result.sitemaps.length}<br>
            &nbsp;— index: ${indexCount}<br>
            &nbsp;— urlset: ${urlsetCount}<br>
            <strong>URL итого:</strong> ${result.urls.length.toLocaleString('ru')}<br>
            <strong>Ошибок:</strong> ${result.errors.length}<br>
            <strong>Макс. глубина:</strong> ${depth}
        `;
    }

    /* ── MD Export ─────────────────────────────────────────────────────────── */
    exportMdBtn.addEventListener('click', async () => {
        if (!crawlResult) return;
        const md = buildMd(crawlResult, urlInput.value.trim());
        const res = await window.api.sitemap.save(md, 'md');
        if (res.success) showToast('MD сохранён: ' + res.filePath, 'success');
        else if (res.error !== 'Отменено') showToast('Ошибка: ' + res.error, 'error');
    });

    function buildMd(result, rootUrl) {
        const now    = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const depth  = treeRoot ? maxDepth(treeRoot) : '?';
        const lines  = [];

        lines.push(`# Sitemap Analysis`);
        lines.push(`\n**URL:** ${rootUrl}  \n**Дата:** ${now}\n`);
        lines.push(`## Сводка\n`);
        lines.push(`| Параметр | Значение |`);
        lines.push(`|---|---|`);
        lines.push(`| Сайтмапов | ${result.sitemaps.length} |`);
        lines.push(`| URL итого | ${result.urls.length.toLocaleString('ru')} |`);
        lines.push(`| Ошибок | ${result.errors.length} |`);
        lines.push(`| Макс. глубина | ${depth} |`);

        lines.push(`\n## Сайтмапы (${result.sitemaps.length})\n`);
        result.sitemaps.forEach(sm => {
            const info = sm.type === 'index' ? `index → ${sm.childCount} дочерних` : `urlset → ${sm.urlCount} URL`;
            lines.push(`- \`${sm.url}\` — ${info}`);
        });

        if (result.errors.length) {
            lines.push(`\n## Ошибки (${result.errors.length})\n`);
            result.errors.forEach(e => lines.push(`- **${e.url}**: ${e.error}`));
        }

        lines.push(`\n## Структура URL\n`);
        if (treeRoot) lines.push(treeToMd(treeRoot, 0));

        return lines.join('\n');
    }

    function treeToMd(node, depth) {
        const indent = '  '.repeat(depth);
        const label  = depth === 0 ? (node.domain || '/') : '/' + node.label;
        const lines  = [`${indent}- **${label}** (${node.urlCount.toLocaleString('ru')} URL)`];

        if (node.leafUrls && node.leafUrls.length > 0) {
            if (node.leafUrls.length >= LEAF_THRESHOLD()) {
                lines.push(`${indent}  - _${node.leafUrls.length.toLocaleString('ru')} конечных страниц_`);
            } else {
                node.leafUrls.forEach(u => {
                    lines.push(`${indent}  - ${u.loc}`);
                });
            }
        }
        if (node.children) {
            for (const child of node.children.values()) {
                lines.push(treeToMd(child, depth + 1));
            }
        }
        return lines.join('\n');
    }

    /* ── JSON Export ───────────────────────────────────────────────────────── */
    exportJsonBtn.addEventListener('click', async () => {
        if (!crawlResult) return;
        const data = {
            meta: {
                rootUrl:      urlInput.value.trim(),
                crawledAt:    new Date().toISOString(),
                totalSitemaps: crawlResult.sitemaps.length,
                totalUrls:    crawlResult.urls.length,
                totalErrors:  crawlResult.errors.length,
                maxDepth:     treeRoot ? maxDepth(treeRoot) : null,
            },
            sitemaps: crawlResult.sitemaps,
            urls:     crawlResult.urls,
            errors:   crawlResult.errors,
            tree:     treeRoot ? serializeTree(treeRoot) : null,
        };
        const json = JSON.stringify(data, null, 2);
        const res  = await window.api.sitemap.save(json, 'json');
        if (res.success) showToast('JSON сохранён: ' + res.filePath, 'success');
        else if (res.error !== 'Отменено') showToast('Ошибка: ' + res.error, 'error');
    });

    function serializeTree(node) {
        const out = {
            label:    node.label,
            path:     node.path,
            urlCount: node.urlCount,
            depth:    node.depth,
            leafCount: node.leafUrls ? node.leafUrls.length : 0,
        };
        if (node.children && node.children.size > 0) {
            out.children = [];
            for (const child of node.children.values()) {
                out.children.push(serializeTree(child));
            }
        }
        return out;
    }

    /* ── Mindmap (canvas) + PNG export ─────────────────────────────────────── */
    mindmapRedrawBtn.addEventListener('click', () => scheduleMindmapDraw());
    exportPngBtn.addEventListener('click', () => exportMindmapPng());

    let mindmapEdges = [];
    let lastMindmapW = 800;
    let lastMindmapH = 400;
    let mmDrawTimer = null;

    function scheduleMindmapDraw() {
        clearTimeout(mmDrawTimer);
        mmDrawTimer = setTimeout(drawMindmap, 60);
    }

    function clearMindmapLayout(node) {
        if (!node) return;
        delete node._mm;
        if (node.children) for (const c of node.children.values()) clearMindmapLayout(c);
    }

    function assignMindmapLayout(node, depth, yCursor, maxDepth) {
        const capped = depth >= maxDepth;
        const children = (!capped && node.children && node.children.size)
            ? [...node.children.values()] : [];
        const depthX = depth * 210 + 32;
        const lab = depth === 0 ? (node.domain || '/') : '/' + node.label;
        const shortLabel = lab.length > 28 ? lab.slice(0, 26) + '…' : lab;

        if (children.length === 0) {
            let lbl = shortLabel;
            if (capped && node.children && node.children.size)
                lbl = `${shortLabel} (+${node.children.size})`;
            node._mm = { x: depthX, y: yCursor, w: 200, h: 32, label: lbl, count: node.urlCount };
            return yCursor + 46;
        }

        let y = yCursor;
        let top = Infinity;
        let bottom = -Infinity;
        for (const ch of children) {
            y = assignMindmapLayout(ch, depth + 1, y, maxDepth);
            top = Math.min(top, ch._mm.y);
            bottom = Math.max(bottom, ch._mm.y + ch._mm.h);
            mindmapEdges.push({ p: node, c: ch });
        }
        const pcy = (top + bottom) / 2 - 16;
        node._mm = { x: depthX, y: pcy, w: 200, h: 32, label: shortLabel, count: node.urlCount };
        return y;
    }

    function normalizeMindmapBoxes(root) {
        const boxes = [];
        (function walk(n) {
            if (n._mm) boxes.push(n._mm);
            if (n.children) for (const c of n.children.values()) walk(c);
        }(root));
        if (!boxes.length) return { w: 640, h: 360 };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const b of boxes) {
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.w);
            maxY = Math.max(maxY, b.y + b.h);
        }
        const pad = 28;
        const dx = pad - minX, dy = pad - minY;
        for (const b of boxes) {
            b.x += dx;
            b.y += dy;
        }
        return {
            w: Math.max(480, Math.ceil(maxX - minX + pad * 2)),
            h: Math.max(260, Math.ceil(maxY - minY + pad * 2)),
        };
    }

    function collectMindmapStyle() {
        const cs = getComputedStyle(document.body);
        return {
            accent:    cs.getPropertyValue('--tab-accent').trim() || '#34d399',
            accentDim: cs.getPropertyValue('--tab-accent-dim').trim() || 'rgba(52,211,153,.2)',
            surface:   cs.getPropertyValue('--md-sys-color-surface-container-high').trim() || '#1e2a3a',
            border:    cs.getPropertyValue('--md-sys-color-outline-variant').trim() || '#2d3748',
            text:      cs.getPropertyValue('--md-sys-color-on-surface').trim() || '#e2e8f0',
            muted:     cs.getPropertyValue('--md-sys-color-on-surface-variant').trim() || '#94a3b8',
            bg:        cs.getPropertyValue('--md-sys-color-background').trim() || '#0d1117',
        };
    }

    function mmRoundedRect(ctx, x, y, w, h, rad, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + rad, y);
        ctx.arcTo(x + w, y, x + w, y + h, rad);
        ctx.arcTo(x + w, y + h, x, y + h, rad);
        ctx.arcTo(x, y + h, x, y, rad);
        ctx.arcTo(x, y, x + w, y, rad);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1.25;
            ctx.stroke();
        }
    }

    function drawMindmapNodeText(ctx, box, st) {
        ctx.textBaseline = 'middle';
        ctx.font = '500 12px Roboto, system-ui, sans-serif';
        ctx.fillStyle = st.text;
        const midY = box.y + box.h / 2;
        let label = box.label;
        const maxW = box.w - 58;
        while (label.length > 2 && ctx.measureText(label).width > maxW)
            label = label.slice(0, -2) + '…';
        ctx.fillText(label, box.x + 10, midY);
        const chip = String(box.count.toLocaleString('ru'));
        ctx.font = '500 11px Roboto, system-ui, sans-serif';
        const chipW = ctx.measureText(chip).width + 10;
        ctx.fillStyle = st.accentDim;
        ctx.fillRect(box.x + box.w - chipW - 8, box.y + 7, chipW, 18);
        ctx.fillStyle = st.accent;
        ctx.fillText(chip, box.x + box.w - chipW + 3, midY);
    }

    function drawMindmapInto(ctx, st) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = st.border;
        for (let i = 0; i < mindmapEdges.length; i++) {
            const e = mindmapEdges[i];
            if (!e.p._mm || !e.c._mm) continue;
            const p = e.p._mm;
            const c = e.c._mm;
            const x1 = p.x + p.w;
            const y1 = p.y + p.h / 2;
            const x2 = c.x;
            const y2 = c.y + c.h / 2;
            const mid = (x1 + x2) / 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(mid, y1);
            ctx.lineTo(mid, y2);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        const ordered = [];
        (function walkCollect(n) {
            if (!n._mm) return;
            if (n !== treeRoot) ordered.push(n);
            if (n.children) for (const c of n.children.values()) walkCollect(c);
        }(treeRoot));

        for (let i = 0; i < ordered.length; i++) {
            const b = ordered[i]._mm;
            mmRoundedRect(ctx, b.x, b.y, b.w, b.h, 8, st.surface, st.border);
            drawMindmapNodeText(ctx, b, st);
        }
        if (treeRoot && treeRoot._mm) {
            const r = treeRoot._mm;
            mmRoundedRect(ctx, r.x, r.y, r.w, r.h, 8, st.accentDim, st.accent);
            drawMindmapNodeText(ctx, r, st);
        }
    }

    function countMmNodes(node) {
        let n = node._mm ? 1 : 0;
        if (node.children) for (const c of node.children.values()) n += countMmNodes(c);
        return n;
    }

    function drawMindmap() {
        if (!mindmapCanvas || !treeRoot) return;

        mindmapEdges = [];
        clearMindmapLayout(treeRoot);
        const maxD = Math.max(3, Math.min(14, parseInt(mindmapDepthEl.value, 10) || 10));
        assignMindmapLayout(treeRoot, 0, 28, maxD);
        const { w, h } = normalizeMindmapBoxes(treeRoot);

        lastMindmapW = w;
        lastMindmapH = h;
        mindmapCanvas.width = w;
        mindmapCanvas.height = h;
        mindmapCanvas.style.width = '';
        mindmapCanvas.style.height = '';

        const ctx = mindmapCanvas.getContext('2d');
        const st = collectMindmapStyle();
        ctx.fillStyle = st.bg;
        ctx.fillRect(0, 0, w, h);
        drawMindmapInto(ctx, st);

        if (mindmapHint) {
            const nn = countMmNodes(treeRoot);
            mindmapHint.textContent = `Узлов: ${nn} · глубина карты ≤ ${maxD}`;
        }

        fitMindmapCanvasCss();
    }

    function fitMindmapCanvasCss() {
        if (!mindmapCanvas || !mindmapHost || !lastMindmapW) return;
        const avail = mindmapHost.clientWidth - 8;
        if (avail <= 0) return;
        const s = Math.min(1, avail / lastMindmapW);
        mindmapCanvas.style.width = `${Math.floor(lastMindmapW * s)}px`;
        mindmapCanvas.style.height = `${Math.floor(lastMindmapH * s)}px`;
    }

    async function exportMindmapPng() {
        if (!treeRoot) { showToast('Нет данных для карты', 'warning'); return; }
        drawMindmap();
        if (!treeRoot._mm) { showToast('Не удалось построить карту', 'error'); return; }

        const scale = 2;
        const c = document.createElement('canvas');
        c.width = Math.ceil(lastMindmapW * scale);
        c.height = Math.ceil(lastMindmapH * scale);
        const ctx = c.getContext('2d');
        const st = collectMindmapStyle();
        ctx.scale(scale, scale);
        ctx.fillStyle = st.bg;
        ctx.fillRect(0, 0, lastMindmapW, lastMindmapH);
        drawMindmapInto(ctx, st);

        const dataUrl = c.toDataURL('image/png');
        let base = 'sitemap-map';
        try { base = new URL(urlInput.value.trim()).hostname.replace(/[^a-z0-9.-]+/gi, '_'); } catch {}
        const res = await window.api.sitemap.savePng(dataUrl, base);
        if (res.success) showToast('PNG сохранён', 'success');
        else if (res.error !== 'Отменено') showToast(res.error, 'error');
    }

    if (mindmapHost && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => fitMindmapCanvasCss()).observe(mindmapHost);
    }

})();
