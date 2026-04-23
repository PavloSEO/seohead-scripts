/* ─ Tab Router ──────────────────────────────────────────────────────────── */
(function () {
    const tabs   = document.querySelectorAll('.tab-item[data-tab]');
    const panels = document.querySelectorAll('.tab-panel');

    function activateTab(target) {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        const tab = document.querySelector(`.tab-item[data-tab="${target}"]`);
        if (tab) tab.classList.add('active');

        const panel = document.getElementById('panel-' + target);
        if (panel) panel.classList.add('active');

        // Per-tab accent: меняем data-tab на body → CSS vars переключаются автоматически
        document.body.dataset.tab = target;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    });

    // Инициализация — redirect активен по умолчанию
    activateTab('redirect');

    /* ─ Window controls ─────────────────────────────────────────────── */
    document.getElementById('btn-minimize')?.addEventListener('click', () => window.api.windowMinimize());
    document.getElementById('btn-maximize')?.addEventListener('click', () => window.api.windowMaximize());
    document.getElementById('btn-close')?.addEventListener('click',    () => window.api.windowClose());

    /* ─ Subpane switcher (mode-tab → right-pane) ────────────────────── */
    document.addEventListener('click', e => {
        const btn = e.target.closest('.mode-tab[data-pane]');
        if (!btn) return;
        const section = btn.closest('section, .tab-panel');
        if (!section) return;
        section.querySelectorAll('.mode-tab[data-pane]').forEach(b => b.classList.remove('active'));
        section.querySelectorAll('.right-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const pane = section.querySelector('#' + btn.dataset.pane);
        if (pane) pane.classList.add('active');
    });

    /* ─ Toast helper (global) ───────────────────────────────────────── */
    window.showToast = function (msg, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const icons = { success:'check_circle', error:'error', warning:'warning', info:'info' };
        const icon  = icons[type] || 'info';
        const el    = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.innerHTML = `<span class="material-symbols-outlined">${icon}</span>${msg}`;
        container.appendChild(el);
        setTimeout(() => {
            el.classList.add('toast--out');
            setTimeout(() => el.remove(), 300);
        }, duration);
    };
})();
