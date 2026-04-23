const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // ── Window ───────────────────────────────────────────────────────────
    windowMinimize:    () => ipcRenderer.invoke('window-minimize'),
    windowMaximize:    () => ipcRenderer.invoke('window-maximize'),
    windowClose:       () => ipcRenderer.invoke('window-close'),
    windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

    // ── Redirect tool ────────────────────────────────────────────────────
    redirect: {
        loadSettings:    ()      => ipcRenderer.invoke('redirect:load-settings'),
        saveSettings:    (s)     => ipcRenderer.invoke('redirect:save-settings', s),
        generateRules:   (...a)  => ipcRenderer.invoke('redirect:generate-rules', ...a),
        generatePreview: (...a)  => ipcRenderer.invoke('redirect:generate-preview', ...a),
        importExcel:     ()      => ipcRenderer.invoke('redirect:import-excel'),
        checkChain:      (url)   => ipcRenderer.invoke('redirect:check-chain', url),
    },

    // ── Optimizer tool ───────────────────────────────────────────────────
    optimizer: {
        getSettings:       ()       => ipcRenderer.invoke('optimizer:get-settings'),
        saveSettings:      (s)      => ipcRenderer.invoke('optimizer:save-settings', s),
        selectFolders:     ()       => ipcRenderer.invoke('optimizer:select-folders'),
        selectFiles:       ()       => ipcRenderer.invoke('optimizer:select-files'),
        selectBackupFolder:()       => ipcRenderer.invoke('optimizer:select-backup-folder'),
        scanPaths:         (p)      => ipcRenderer.invoke('optimizer:scan-paths', p),
        optimize:          (f, s)   => ipcRenderer.invoke('optimizer:optimize', { files: f, settings: s }),
        getImagePreview:   (p)      => ipcRenderer.invoke('optimizer:get-image-preview', p),
        getFileInfo:       (p)      => ipcRenderer.invoke('optimizer:get-file-info', p),
        openFolder:        (p)      => ipcRenderer.invoke('optimizer:open-folder', p),
        restoreFromBackup: (f, b)   => ipcRenderer.invoke('optimizer:restore-from-backup', { filePath: f, backupPath: b }),
        onProgress: (cb) => ipcRenderer.on('optimization-progress', (_, d) => cb(d)),
        removeProgressListener: () => ipcRenderer.removeAllListeners('optimization-progress'),
    },

    // ── SEO Parser ───────────────────────────────────────────────────────
    parser: {
        parseUrls:  (urls, opts)   => ipcRenderer.invoke('parser:parse-urls', urls, opts),
        saveMarkdown: (content, mode) => ipcRenderer.invoke('parser:save-markdown', content, mode),
        onProgress: (cb) => ipcRenderer.on('parser-progress', (_, d) => cb(d)),
        removeProgressListener: () => ipcRenderer.removeAllListeners('parser-progress'),
    },

    // ── Image Downloader ─────────────────────────────────────────────────
    downloader: {
        selectFolder:  ()           => ipcRenderer.invoke('downloader:select-folder'),
        download:      (urls, dir, opts) => ipcRenderer.invoke('downloader:download', urls, dir, opts),
        openFolder:    (p)          => ipcRenderer.invoke('downloader:open-folder', p),
        onProgress: (cb) => ipcRenderer.on('downloader-progress', (_, d) => cb(d)),
        removeProgressListener: () => ipcRenderer.removeAllListeners('downloader-progress'),
    },

    // ── Keyword Clusterer ────────────────────────────────────────────────
    clusterer: {
        checkPython:  ()            => ipcRenderer.invoke('clusterer:check-python'),
        selectFile:   ()            => ipcRenderer.invoke('clusterer:select-file'),
        run:          (params)      => ipcRenderer.invoke('clusterer:run', params),
        saveResult:   (clusters, fmt) => ipcRenderer.invoke('clusterer:save-result', clusters, fmt),
        onLog: (cb) => ipcRenderer.on('clusterer-log', (_, d) => cb(d)),
        removeLogListener: () => ipcRenderer.removeAllListeners('clusterer-log'),
    },
});
