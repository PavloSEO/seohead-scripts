const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage } = require('electron');
const path       = require('path');
const fs         = require('fs');
const { spawn }  = require('child_process');
const Store      = require('electron-store');
const xlsx       = require('xlsx');
const { generateRules, generateRule, checkChain } = require('./redirects');
const optimizer  = require('./optimizer');
const { parseUrl }       = require('./parser');
const { downloadImages } = require('./downloader');
const { crawl: crawlSitemap } = require('./sitemap');

Menu.setApplicationMenu(null);

// ── CLUSTERER PATH RESOLVER ──────────────────────────────────────────────────
// Dev:    запускаем python3 clusterer.py
// Packed: запускаем clusterer.exe из extraResources
function getClustererExe() {
    if (app.isPackaged) {
        // electron-builder кладёт extraResources в {appRoot}/resources/
        const exePath = path.join(process.resourcesPath, 'clusterer.exe');
        if (fs.existsSync(exePath)) return { cmd: exePath, args: [], mode: 'exe' };
        // fallback: рядом с .exe приложения
        const sameDir = path.join(path.dirname(process.execPath), 'clusterer.exe');
        if (fs.existsSync(sameDir)) return { cmd: sameDir, args: [], mode: 'exe' };
        return { cmd: null, args: [], mode: 'missing' };
    }
    // Dev mode — python + .py
    const pyScript = path.join(__dirname, 'clusterer.py');
    return { cmd: null, args: [pyScript], mode: 'dev' };
}


// ── STORES ───────────────────────────────────────────────────────────────────
const redirectStore = new Store({
    name: 'redirect-config',
    defaults: { format: 'apache-rewrite-rule', customTemplate: '', defaultUrl: '/', enableRedirectToDefault: false }
});
const optimizerStore = new Store({
    name: 'optimizer-config',
    defaults: { quality: 85, level: 2, createBackup: true, keepResolution: true, removeMetadata: true, useSlug: false, backupFolder: '' }
});

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1380, height: 860,
        minWidth: 980, minHeight: 620,
        frame: false,
        backgroundColor: '#0d1117',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        show: false,
        icon: path.join(__dirname, '../assets/icon.png')
    });
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── WINDOW ───────────────────────────────────────────────────────────────────
ipcMain.handle('window-minimize',     () => mainWindow?.minimize());
ipcMain.handle('window-maximize',     () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.handle('window-close',        () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

// ── REDIRECT ─────────────────────────────────────────────────────────────────
ipcMain.handle('redirect:load-settings',    async () => { try { return { success: true, settings: redirectStore.store }; } catch(e) { return { success: false, error: e.message }; } });
ipcMain.handle('redirect:save-settings',    async (_, s) => { try { redirectStore.set(s); return { success: true }; } catch(e) { return { success: false, error: e.message }; } });
ipcMain.handle('redirect:generate-rules',   async (_, ...a) => { try { return { success: true, rules: generateRules(...a) }; } catch(e) { return { success: false, error: e.message }; } });
ipcMain.handle('redirect:generate-preview', async (_, ...a) => { try { return generateRule(...a); } catch(e) { throw e; } });
ipcMain.handle('redirect:check-chain',      async (_, url) => { try { const chain = await checkChain(url); return { success: true, chain }; } catch(e) { return { success: false, error: e.message }; } });

ipcMain.handle('redirect:import-excel', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Выберите Excel файл',
            filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }, { name: 'Все', extensions: ['*'] }],
            properties: ['openFile']
        });
        if (result.canceled || !result.filePaths?.length) return { success: false, error: 'Файл не выбран' };
        const filePath = result.filePaths[0];
        const workbook = xlsx.readFile(filePath);
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const data     = xlsx.utils.sheet_to_json(sheet);
        if (!data?.length) return { success: false, error: 'Файл пуст' };
        return { success: true, data };
    } catch(e) { return { success: false, error: e.message }; }
});

// ── OPTIMIZER ────────────────────────────────────────────────────────────────
ipcMain.handle('optimizer:get-settings',       async () => { try { return { success: true, settings: optimizerStore.store }; } catch(e) { return { success:false, error:e.message }; } });
ipcMain.handle('optimizer:save-settings',      async (_, s) => { try { optimizerStore.set(s); return { success: true }; } catch(e) { return { success:false, error:e.message }; } });
ipcMain.handle('optimizer:select-folders',     async () => { const r = await dialog.showOpenDialog(mainWindow, { title:'Выбрать папки', properties:['openDirectory','multiSelections'] }); return r.canceled ? [] : r.filePaths; });
ipcMain.handle('optimizer:select-files',       async () => { const r = await dialog.showOpenDialog(mainWindow, { title:'Выбрать файлы', filters:[{name:'Изображения',extensions:['jpg','jpeg','png','webp','gif','svg','tiff','tif']}], properties:['openFile','multiSelections'] }); return r.canceled ? [] : r.filePaths; });
ipcMain.handle('optimizer:select-backup-folder', async () => { const r = await dialog.showOpenDialog(mainWindow, { title:'Папка для бэкапов', properties:['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle('optimizer:scan-paths',         async (_, p) => { try { return await optimizer.scanPaths(p); } catch(e) { return { success:false, error:e.message }; } });
ipcMain.handle('optimizer:optimize',           async (ev, { files, settings }) => { try { return await optimizer.optimizeFiles(files, settings, (p) => mainWindow?.webContents.send('optimization-progress', p)); } catch(e) { return { success:false, error:e.message }; } });
ipcMain.handle('optimizer:get-image-preview',  async (_, p) => { try { return await optimizer.getImagePreview(p); } catch(e) { return { success:false, error:e.message }; } });
ipcMain.handle('optimizer:get-file-info',      async (_, p) => { try { return await optimizer.getFileInfo(p); } catch(e) { return { success:false, error:e.message }; } });
ipcMain.handle('optimizer:open-folder',        async (_, p) => { await shell.openPath(p); });
ipcMain.handle('optimizer:restore-from-backup', async (_, { filePath, backupPath }) => { try { return await optimizer.restoreFromBackup(filePath, backupPath); } catch(e) { return { success:false, error:e.message }; } });

// ── SEO PARSER ───────────────────────────────────────────────────────────────
ipcMain.handle('parser:parse-urls', async (_, urls, opts) => {
    const delay = parseInt(opts.delay) || 0;
    const results = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i].trim();
        if (!url) continue;
        mainWindow?.webContents.send('parser-progress', { type: 'start', url, index: i, total: urls.length });
        const res = await parseUrl(url, opts);
        results.push(res);
        mainWindow?.webContents.send('parser-progress', { type: 'done', url, index: i, total: urls.length, result: res });
        if (delay && i < urls.length - 1) await new Promise(r => setTimeout(r, delay));
    }

    return { success: true, results };
});

ipcMain.handle('parser:save-markdown', async (_, content, mode) => {
    try {
        if (mode === 'single' || typeof content === 'string') {
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Сохранить MD файл',
                defaultPath: `seo-parse-${Date.now()}.md`,
                filters: [{ name: 'Markdown', extensions: ['md'] }]
            });
            if (!filePath) return { success: false, error: 'Отменено' };
            fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content));
            return { success: true, filePath };
        } else {
            // multi: content = [{url, md}]
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
                title: 'Выберите папку для сохранения',
                properties: ['openDirectory']
            });
            if (!filePaths?.length) return { success: false, error: 'Отменено' };
            const dir = filePaths[0];
            const saved = [];
            content.forEach(({ url, md }) => {
                const safe = url.replace(/[^a-z0-9]/gi, '_').substring(0, 60);
                const fp = path.join(dir, `${safe}.md`);
                fs.writeFileSync(fp, md);
                saved.push(fp);
            });
            return { success: true, dir, count: saved.length };
        }
    } catch(e) { return { success: false, error: e.message }; }
});

// ── IMAGE DOWNLOADER ─────────────────────────────────────────────────────────
ipcMain.handle('downloader:select-folder', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { title: 'Папка для сохранения', properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('downloader:download', async (_, urls, outputDir, opts) => {
    try {
        const results = await downloadImages(urls, outputDir, opts, (item) => {
            mainWindow?.webContents.send('downloader-progress', item);
        });
        return { success: true, results };
    } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('downloader:open-folder', async (_, p) => { await shell.openPath(p); });

// ── KEYWORD CLUSTERER ─────────────────────────────────────────────────────────
ipcMain.handle('clusterer:check-python', async () => {
    const clusterer = getClustererExe();

    // Packaged: проверяем наличие exe
    if (app.isPackaged) {
        if (clusterer.mode === 'exe') {
            return { found: true, cmd: clusterer.cmd, version: 'clusterer.exe (standalone)', mode: 'exe' };
        }
        return { found: false, error: 'clusterer.exe не найден в resources. Пересоберите проект.' };
    }

    // Dev: ищем Python в PATH
    return new Promise((resolve) => {
        const candidates = ['python3', 'python'];
        let i = 0;
        const tryNext = () => {
            if (i >= candidates.length) return resolve({ found: false, error: 'Python не найден. Установите Python 3.8+ и: pip install scikit-learn numpy' });
            const cmd = candidates[i++];
            const proc = spawn(cmd, ['--version'], { shell: true });
            let out = '';
            proc.stdout.on('data', d => out += d);
            proc.stderr.on('data', d => out += d);
            proc.on('close', code => {
                if (code === 0) resolve({ found: true, cmd, version: out.trim(), mode: 'dev' });
                else tryNext();
            });
            proc.on('error', () => tryNext());
        };
        tryNext();
    });
});

ipcMain.handle('clusterer:select-file', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
        title: 'Файл с ключевыми фразами',
        filters: [
            { name: 'CSV / TXT', extensions: ['csv', 'txt'] },
            { name: 'Все файлы', extensions: ['*'] }
        ],
        properties: ['openFile']
    });
    return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('clusterer:run', async (_, params) => {
    return new Promise((resolve) => {
        const clusterer = getClustererExe();
        let spawnCmd, spawnArgs;

        if (app.isPackaged && clusterer.mode === 'exe') {
            // Production: запускаем standalone exe
            spawnCmd  = clusterer.cmd;
            spawnArgs = [];
        } else {
            // Dev: python + .py
            const scriptPath = path.join(__dirname, 'clusterer.py');
            spawnCmd  = params.pythonCmd || 'python3';
            spawnArgs = [scriptPath];
        }

        const proc = spawn(spawnCmd, spawnArgs, { shell: process.platform === 'win32' });
        proc.stdin.write(JSON.stringify(params));
        proc.stdin.end();

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            lines.forEach(line => {
                if (!line.trim()) return;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.log) {
                        mainWindow?.webContents.send('clusterer-log', { msg: parsed.log, level: parsed.level });
                    } else {
                        stdout += line + '\n';
                    }
                } catch {
                    stdout += line + '\n';
                }
            });
        });

        proc.stderr.on('data', d => {
            stderr += d.toString();
            mainWindow?.webContents.send('clusterer-log', { msg: d.toString().trim(), level: 'warn' });
        });

        proc.on('close', (code) => {
            try {
                const result = JSON.parse(stdout.trim());
                resolve(result);
            } catch(e) {
                resolve({ error: `Ошибка парсинга вывода: ${e.message}\nstderr: ${stderr}` });
            }
        });

        proc.on('error', (e) => resolve({ error: `Не удалось запустить Python: ${e.message}` }));
    });
});

ipcMain.handle('clusterer:save-result', async (_, clusters, fmt) => {
    try {
        if (fmt === 'xlsx') {
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Сохранить результат',
                defaultPath: `keywords-clusters-${Date.now()}.xlsx`,
                filters: [{ name: 'Excel', extensions: ['xlsx'] }]
            });
            if (!filePath) return { success: false, error: 'Отменено' };

            const wb = xlsx.utils.book_new();
            clusters.forEach((cl) => {
                const ws = xlsx.utils.aoa_to_sheet(
                    [['Ключевая фраза', 'Кластер', 'Кол-во в кластере'],
                     ...cl.keywords.map(kw => [kw, cl.name, cl.count])]
                );
                const safeName = cl.name.substring(0, 30).replace(/[\\/*?:[\]]/g, '_');
                xlsx.utils.book_append_sheet(wb, ws, safeName);
            });

            // Общий лист
            const allRows = [['Ключевая фраза', 'ID кластера', 'Название кластера']];
            clusters.forEach(cl => cl.keywords.forEach(kw => allRows.push([kw, cl.id, cl.name])));
            xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(allRows), '_Все');

            xlsx.writeFile(wb, filePath);
            return { success: true, filePath };
        } else {
            // CSV
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Сохранить результат',
                defaultPath: `keywords-clusters-${Date.now()}.csv`,
                filters: [{ name: 'CSV', extensions: ['csv'] }]
            });
            if (!filePath) return { success: false, error: 'Отменено' };

            const rows = ['\uFEFFКлючевая фраза,ID кластера,Название кластера,Размер кластера'];
            clusters.forEach(cl => cl.keywords.forEach(kw => {
                const safe = (v) => `"${String(v).replace(/"/g,'""')}"`;
                rows.push(`${safe(kw)},${cl.id},${safe(cl.name)},${cl.count}`);
            }));
            fs.writeFileSync(filePath, rows.join('\n'), 'utf8');
            return { success: true, filePath };
        }
    } catch(e) { return { success: false, error: e.message }; }
});

// ── SITEMAP ANALYSER ──────────────────────────────────────────────────────────
ipcMain.handle('sitemap:crawl', async (_, url, opts) => {
    try {
        const result = await crawlSitemap(url, {
            concurrency: opts?.concurrency || 3,
            onProgress: (p) => mainWindow?.webContents.send('sitemap-progress', p),
        });
        return { success: true, ...result };
    } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('sitemap:save', async (_, content, format) => {
    try {
        const ext  = format === 'json' ? 'json' : 'md';
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title:       `Сохранить ${ext.toUpperCase()}`,
            defaultPath: `sitemap-analysis-${Date.now()}.${ext}`,
            filters:     [{ name: ext.toUpperCase(), extensions: [ext] }],
        });
        if (!filePath) return { success: false, error: 'Отменено' };
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true, filePath };
    } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('sitemap:savePng', async (_, dataUrl, defaultBase) => {
    try {
        const image = nativeImage.createFromDataURL(dataUrl);
        if (image.isEmpty()) return { success: false, error: 'Пустое изображение' };
        const buf = image.toPNG();
        const base = (typeof defaultBase === 'string' && defaultBase.trim())
            ? defaultBase.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)
            : `sitemap-map-${Date.now()}`;
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title:       'Сохранить карту PNG',
            defaultPath: `${base}.png`,
            filters:     [{ name: 'PNG', extensions: ['png'] }],
        });
        if (!filePath) return { success: false, error: 'Отменено' };
        fs.writeFileSync(filePath, buf);
        shell.showItemInFolder(filePath);
        return { success: true, filePath };
    } catch (e) { return { success: false, error: e.message }; }
});
