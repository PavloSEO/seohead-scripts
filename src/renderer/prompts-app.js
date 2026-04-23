/* ═══ Prompt Library — статичные промпты, без API ═══ */
(function () {
    const PROMPTS = window.PROMPTS;
    if (!Array.isArray(PROMPTS) || !PROMPTS.length) {
        console.warn('prompts-app: window.PROMPTS пуст');
        return;
    }

    const el = {
        search: document.getElementById('pl-search'),
        catTree: document.getElementById('pl-cat-tree'),
        stats: document.getElementById('pl-stats'),
        tagsBtn: document.getElementById('pl-tags-btn'),
        tagPop: document.getElementById('pl-tag-popover'),
        modelFilters: document.getElementById('pl-model-filters'),
        viewList: document.getElementById('pl-view-list'),
        viewGrid: document.getElementById('pl-view-grid'),
        cards: document.getElementById('pl-cards'),
        plEmpty: document.getElementById('pl-empty'),
        previewBody: document.getElementById('pl-preview-body'),
        pvTitle: document.getElementById('pl-pv-title'),
        copyBtn: document.getElementById('pl-copy-btn'),
        saveBtn: document.getElementById('pl-save-md-btn'),
        pvMeta: document.getElementById('pl-pv-meta'),
        varsHeader: document.getElementById('pl-vars-header'),
        varInputs: document.getElementById('pl-var-inputs'),
        pvPrompt: document.getElementById('pl-pv-prompt'),
        exOut: document.getElementById('pl-pv-ex-out')
    };

    const MONTHS_RU = { '01': 'Январь', '02': 'Февраль', '03': 'Март', '04': 'Апрель', '05': 'Май', '06': 'Июнь', '07': 'Июль', '08': 'Август', '09': 'Сентябрь', '10': 'Октябрь', '11': 'Ноябрь', '12': 'Декабрь' };

    function monthLabel(updated) {
        if (!updated || typeof updated !== 'string') return '';
        const m = updated.split('-');
        if (m.length < 2) return updated;
        const name = MONTHS_RU[m[1]] || m[1];
        return m[0] && name ? `${name} ${m[0]}` : updated;
    }

    const totalPrompts = PROMPTS.length;
    const allTags = Array.from(
        new Set(PROMPTS.flatMap((p) => p.tags || []))
    ).sort((a, b) => a.localeCompare(b, 'ru'));

    /** @type {Set<string>} */
    const selectedTags = new Set();
    /** @type {Set<string>} */
    const activeModels = new Set();

    let catState = { mode: 'all' }; // { mode:'all' } | { mode:'cat', c } | { mode:'sub', c, s }
    let viewMode = 'list'; // 'list' | 'grid'
    /** @type {string | null} */
    let selectedId = null;
    /** @type {Record<string, Record<string, string>>} */
    const varMapById = {};
    const modelsList = ['ChatGPT', 'Claude', 'Gemini'];

    function buildCategoryTree() {
        /** @type {Map<string, Map<string, number>>} */
        const map = new Map();
        for (const p of PROMPTS) {
            if (!map.has(p.category)) map.set(p.category, new Map());
            const sub = map.get(p.category);
            sub.set(p.subcategory, (sub.get(p.subcategory) || 0) + 1);
        }
        const order = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, 'ru'));
        return { map, order };
    }

    const { map: catMap, order: catOrder } = buildCategoryTree();

    function matchCat(p) {
        if (catState.mode === 'all') return true;
        if (catState.mode === 'cat') return p.category === catState.c;
        if (catState.mode === 'sub') return p.category === catState.c && p.subcategory === catState.s;
        return true;
    }

    function searchMatch(p, q) {
        if (!q) return true;
        const t = p.tags && p.tags.length ? p.tags.join(' ') : '';
        const blob = [p.title, p.description, t, p.prompt || ''].join('\n').toLowerCase();
        return blob.includes(q);
    }

    function tagFilter(p) {
        if (selectedTags.size === 0) return true;
        const set = new Set(p.tags || []);
        for (const t of selectedTags) {
            if (set.has(t)) return true;
        }
        return false;
    }

    function modelFilter(p) {
        if (activeModels.size === 0) return true;
        const m = p.model || [];
        return m.some((x) => activeModels.has(x));
    }

    function getFiltered() {
        const q = (el.search && el.search.value) ? el.search.value.trim().toLowerCase() : '';
        return PROMPTS.filter((p) => matchCat(p) && searchMatch(p, q) && tagFilter(p) && modelFilter(p));
    }

    function applySubstitution(text, values) {
        if (!text) return '';
        let out = text;
        for (const [k, v] of Object.entries(values)) {
            if (v) out = out.split(k).join(v);
        }
        return out;
    }

    function getVarValues() {
        const item = PROMPTS.find((p) => p.id === selectedId);
        if (!item) return {};
        return varMapById[item.id] || {};
    }

    function getResolvedPrompt() {
        const item = PROMPTS.find((p) => p.id === selectedId);
        if (!item) return '';
        return applySubstitution(item.prompt, getVarValues());
    }

    function renderStats(foundCount) {
        if (!el.stats) return;
        el.stats.innerHTML = `
            <div class="pl-stats" style="border-top:0;padding-top:0">
                <span class="material-symbols-outlined">menu_book</span> Всего: ${totalPrompts} промптов
            </div>
            <div class="pl-stats">
                <span class="material-symbols-outlined">label</span> Тегов: ${allTags.length}
            </div>
            <div class="pl-stats" style="margin-top:4px; padding-top:6px; border-top:1px solid var(--md-sys-color-outline-variant)">
                <span class="material-symbols-outlined">search</span> Найдено: ${foundCount}
            </div>
        `;
    }

    function renderCatTree() {
        if (!el.catTree) return;
        let html = `<div class="cat-tree__all${catState.mode === 'all' ? ' active' : ''}" id="pl-cat-all" data-cat="all" role="button" tabindex="0" style="margin-bottom:6px">Все промпты</div>`;
        for (const c of catOrder) {
            const subs = catMap.get(c);
            const total = Array.from(subs.values()).reduce((a, b) => a + b, 0);
            const isCatActive = catState.mode === 'cat' && catState.c === c;
            const subKeys = Array.from(subs.keys()).sort((a, b) => a.localeCompare(b, 'ru'));
            html += `<div class="cat-tree__block" style="margin-bottom:6px">`;
            html += `<div class="cat-item${isCatActive ? ' active' : ''}" data-cat="${escAttr(c)}" data-sub=""><span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;opacity:0.75;margin-right:4px">folder</span>${escHtml(c)}<span class="cat-item__count">(${total})</span></div>`;
            for (const s of subKeys) {
                const n = subs.get(s);
                const isSub = catState.mode === 'sub' && catState.c === c && catState.s === s;
                html += `<div class="cat-item cat-item--sub${isSub ? ' active' : ''}" data-cat="${escAttr(c)}" data-sub="${escAttr(s)}">${escHtml(s)}<span class="cat-item__count">(${n})</span></div>`;
            }
            html += `</div>`;
        }
        el.catTree.innerHTML = html;
    }

    function escAttr(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }
    function escHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderTagMenu() {
        if (!el.tagPop) return;
        if (!allTags.length) {
            el.tagPop.innerHTML = '<div class="text-muted" style="padding:8px">Нет тегов</div>';
            return;
        }
        el.tagPop.innerHTML = allTags.map((t) => {
            const on = selectedTags.has(t) ? ' active' : '';
            return `<button type="button" class="tag-chip${on}" data-tag="${escAttr(t)}">#${escHtml(t)}</button>`;
        }).join(' ');
    }

    function setViewButtons() {
        if (el.viewList && el.viewGrid) {
            if (viewMode === 'list') {
                el.viewList.className = 'md-btn md-btn--tonal md-btn--sm';
                el.viewGrid.className = 'md-btn md-btn--outlined md-btn--sm';
            } else {
                el.viewList.className = 'md-btn md-btn--outlined md-btn--sm';
                el.viewGrid.className = 'md-btn md-btn--tonal md-btn--sm';
            }
        }
    }

    function renderCards(list) {
        if (!el.cards) return;
        if (el.plEmpty) el.plEmpty.style.display = list.length ? 'none' : 'block';
        if (viewMode === 'grid') {
            el.cards.classList.add('prompts-list-wrap--grid');
        } else {
            el.cards.classList.remove('prompts-list-wrap--grid');
        }
        const frag = document.createDocumentFragment();
        for (const p of list) {
            const card = document.createElement('div');
            card.className = 'prompt-card' + (p.id === selectedId ? ' active' : '');
            card.dataset.id = p.id;
            const modelsHtml = (p.model || modelsList)
                .map((m) => `<span class="prompt-model-dot">${escHtml(m)}</span>`)
                .join(' ');
            const firstTags = (p.tags || []).slice(0, 2).map((t) => `<span class="prompt-model-dot">#${escHtml(t)}</span>`).join(' ');

            if (viewMode === 'list') {
                card.innerHTML = `
                    <div class="prompt-card__row-top">
                        <span>[${escHtml(p.category)} / ${escHtml(p.subcategory)}]</span>
                        <span style="flex:1"></span>
                        ${modelsHtml}
                        ${firstTags}
                    </div>
                    <h3 class="prompt-card__title">${escHtml(p.title)}</h3>
                    <p class="prompt-card__desc">${escHtml(p.description)}</p>
                    <div class="prompt-card__vars">Переменные: ${p.variables && p.variables.length ? p.variables.map((x) => escHtml(x)).join('  ') : '—'}</div>
                    <div class="prompt-card__footer"><span class="text-muted" style="font-size:12px">Открыть →</span></div>
                `;
            } else {
                const nVar = p.variables && p.variables.length ? `${p.variables.length} переменных` : '0 переменных';
                const shortM = (p.model || modelsList).slice(0, 2).map((m) => `<span class="prompt-model-dot">${escHtml(m)}</span>`).join(' ');
                card.innerHTML = `
                    <div class="prompt-card__row-top"><span style="max-width:100%">[${escHtml(p.category)} / ${escHtml(p.subcategory)}]</span></div>
                    <h3 class="prompt-card__title" style="font-size:14px; -webkit-line-clamp:2">${escHtml(p.title)}</h3>
                    <p class="text-muted" style="font-size:11px; margin:0">${nVar}</p>
                    <div class="prompt-card__models" style="margin-top:8px; justify-content:space-between; align-items:center; width:100%">
                        <span style="display:flex; flex-wrap:wrap; gap:4px;">${shortM}</span>
                        <span class="text-muted" style="font-size:12px">→</span>
                    </div>
                `;
            }
            frag.appendChild(card);
        }
        while (el.cards.firstChild) el.cards.removeChild(el.cards.firstChild);
        if (el.plEmpty) el.cards.appendChild(el.plEmpty);
        el.cards.appendChild(frag);
    }

    function renderPreview() {
        const item = PROMPTS.find((p) => p.id === selectedId);
        if (!item) {
            if (el.previewBody) el.previewBody.style.display = 'none';
            if (el.pvTitle) el.pvTitle.textContent = 'Выберите промпт';
            return;
        }
        if (el.previewBody) el.previewBody.style.display = 'block';
        if (el.pvTitle) el.pvTitle.textContent = item.title;

        if (!varMapById[item.id]) varMapById[item.id] = {};
        const vm = varMapById[item.id];
        (item.variables || []).forEach((k) => {
            if (vm[k] === undefined) vm[k] = '';
        });

        if (el.pvMeta) {
            const tagsL = (item.tags || []).map((t) => `<span class="text-accent">#${escHtml(t)}</span>`).join(' ');
            el.pvMeta.innerHTML = `
                <div>📂 ${escHtml(item.category)} / ${escHtml(item.subcategory)}</div>
                <div style="margin-top:4px">🔖 ${tagsL || '—'}</div>
                <div style="margin-top:4px">🤖 ${(item.model || []).join(' · ')}</div>
                <div style="margin-top:4px">📅 ${escHtml(monthLabel(item.updated))} · ${escHtml(item.author || '')}</div>
            `;
        }
        if (el.varsHeader) {
            const hasV = item.variables && item.variables.length;
            el.varsHeader.style.display = hasV ? 'block' : 'none';
        }
        if (el.varInputs) {
            el.varInputs.innerHTML = '';
            (item.variables || []).forEach((key) => {
                const g = document.createElement('div');
                g.className = 'var-group';
                g.innerHTML = `<label class="var-label" for="var-${item.id}-${hash(key)}">${escHtml(key)}</label>
                    <input class="var-input md-field" data-var="${escAttr(key)}" id="var-${item.id}-${hash(key)}" type="text" placeholder="значение" value="${escAttr(vm[key] || '')}">`;
                el.varInputs.appendChild(g);
            });
            el.varInputs.querySelectorAll('input[data-var]').forEach((inp) => {
                inp.addEventListener('input', () => {
                    const k = inp.getAttribute('data-var');
                    if (k) varMapById[item.id][k] = inp.value;
                    if (el.pvPrompt) el.pvPrompt.value = getResolvedPrompt();
                });
            });
        }
        if (el.pvPrompt) el.pvPrompt.value = getResolvedPrompt();
        if (el.exOut) {
            const exo = (item.example_output && String(item.example_output).trim()) ? String(item.example_output) : '—';
            el.exOut.textContent = exo;
        }
    }

    function hash(s) {
        return String(s).split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0) >>> 0;
    }

    function buildMdFile() {
        const item = PROMPTS.find((p) => p.id === selectedId);
        if (!item) return '';
        const varsLines = (item.variables || []).map(
            (v) => '- `' + String(v) + '` — подставьте значение для этого плейсхолдера.'
        ).join('\n');
        const inEx = (item.example_input && String(item.example_input).trim()) || '—';
        const outEx = (item.example_output && String(item.example_output).trim()) || '—';
        return `# ${item.title}
> Категория: ${item.category} / ${item.subcategory}  
> Теги: ${(item.tags || []).join(', ')}  
> Модели: ${(item.model || []).join(', ')}  
> Обновлено: ${monthLabel(item.updated)}

## Промпт
${item.prompt}

## Переменные
${varsLines}

## Пример входных данных
${inEx}

## Пример результата
${outEx}
`;
    }

    function fullRefresh() {
        const list = getFiltered();
        renderStats(list.length);
        renderCards(list);
        if (selectedId && !list.find((p) => p.id === selectedId)) {
            selectedId = null;
        }
        renderPreview();
    }

    el.search?.addEventListener('input', () => fullRefresh());

    el.catTree?.addEventListener('click', (e) => {
        const t = e.target && e.target.closest && e.target.closest('.cat-tree__all, .cat-item[data-cat]');
        if (!t) return;
        const cat = t.getAttribute('data-cat');
        const sub = t.getAttribute('data-sub') || '';
        if (cat === 'all') {
            catState = { mode: 'all' };
        } else if (sub === '' || sub == null) {
            catState = { mode: 'cat', c: cat };
        } else {
            catState = { mode: 'sub', c: cat, s: sub };
        }
        renderCatTree();
        fullRefresh();
    });

    el.tagsBtn?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!el.tagPop) return;
        const vis = el.tagPop.style.display !== 'none';
        el.tagPop.style.display = vis ? 'none' : 'block';
        if (!vis) {
            el.tagsBtn?.setAttribute('aria-expanded', 'true');
        } else {
            el.tagsBtn?.setAttribute('aria-expanded', 'false');
        }
    });

    el.tagPop?.addEventListener('click', (e) => {
        const chip = e.target && e.target.closest && e.target.closest('.tag-chip[data-tag]');
        if (!chip) return;
        e.stopPropagation();
        const t = chip.getAttribute('data-tag');
        if (!t) return;
        if (selectedTags.has(t)) selectedTags.delete(t);
        else selectedTags.add(t);
        renderTagMenu();
        fullRefresh();
    });

    document.addEventListener('click', (e) => {
        if (el.tagPop && el.tagsBtn && !e.target.closest('#pl-tag-popover') && !e.target.closest('#pl-tags-btn')) {
            el.tagPop.style.display = 'none';
            el.tagsBtn.setAttribute('aria-expanded', 'false');
        }
    });

    el.modelFilters?.addEventListener('click', (e) => {
        const b = e.target && e.target.closest && e.target.closest('.model-btn[data-model]');
        if (!b) return;
        const m = b.getAttribute('data-model');
        if (!m) return;
        const on = b.classList.toggle('active');
        if (on) activeModels.add(m);
        else activeModels.delete(m);
        fullRefresh();
    });

    el.viewList?.addEventListener('click', () => { viewMode = 'list'; setViewButtons(); fullRefresh(); });
    el.viewGrid?.addEventListener('click', () => { viewMode = 'grid'; setViewButtons(); fullRefresh(); });

    el.cards?.addEventListener('click', (e) => {
        const c = e.target && e.target.closest && e.target.closest('.prompt-card[data-id]');
        if (!c) return;
        selectedId = c.getAttribute('data-id') || null;
        el.cards.querySelectorAll('.prompt-card').forEach((node) => {
            node.classList.toggle('active', node.dataset.id === selectedId);
        });
        renderPreview();
    });

    el.copyBtn?.addEventListener('click', () => {
        const t = getResolvedPrompt();
        if (!t) {
            showToast('Нет текста', 'warning');
            return;
        }
        navigator.clipboard.writeText(t).then(() => showToast('Промпт скопирован', 'success'));
    });

    el.saveBtn?.addEventListener('click', async () => {
        const item = PROMPTS.find((p) => p.id === selectedId);
        if (!item) {
            showToast('Выберите промпт', 'warning');
            return;
        }
        const content = buildMdFile();
        try {
            const res = await window.api.parser.saveMarkdown(content, 'single');
            if (res && res.success) showToast('MD сохранён', 'success');
            else showToast((res && res.error) || 'Ошибка сохранения', 'error');
        } catch (err) {
            showToast(err && err.message ? err.message : 'Ошибка', 'error');
        }
    });

    // Init
    renderTagMenu();
    setViewButtons();
    renderCatTree();
    fullRefresh();
})();
