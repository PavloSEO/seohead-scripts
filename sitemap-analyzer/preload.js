const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('api', {
  parseSitemap: (url, concurrency) =>
    ipcRenderer.invoke('parse-sitemap', { url, concurrency }),

  onProgress: (cb) =>
    ipcRenderer.on('parse-progress', (_, msg) => cb(msg)),

  removeProgressListeners: () =>
    ipcRenderer.removeAllListeners('parse-progress'),

  exportData: (format, data, host) =>
    ipcRenderer.invoke('export', { format, data, host }),

  exportPng: (dataUrl, host) =>
    ipcRenderer.invoke('export-png', { dataUrl, host }),

  clipboardWrite: (text) =>
    ipcRenderer.invoke('clipboard-write', text),

  openExternal: (url) => shell.openExternal(url),
});
