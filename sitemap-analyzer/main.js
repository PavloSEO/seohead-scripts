const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f13',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  mainWindow.loadFile('index.html');

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── IPC: parse sitemap ───────────────────────────────────────────────────────
const { parseSitemapRecursive } = require('./sitemap-parser');

ipcMain.handle('parse-sitemap', async (event, { url, concurrency }) => {
  const onProgress = (msg) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('parse-progress', msg);
    }
  };
  try {
    const result = await parseSitemapRecursive(url, concurrency, onProgress);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: export ─────────────────────────────────────────────────────────────
const { exportMarkdown, exportJSON } = require('./exporter');

ipcMain.handle('export', async (event, { format, data, host }) => {
  const ext = format === 'json' ? 'json' : 'md';
  const label = format === 'json' ? 'JSON' : 'Markdown';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: `Сохранить ${label}`,
    defaultPath: `sitemap-${host.replace(/[^a-z0-9]/gi, '_')}.${ext}`,
    filters: [{ name: label, extensions: [ext] }],
  });
  if (canceled || !filePath) return { ok: false };

  let content;
  if (format === 'json') content = exportJSON(data);
  else content = exportMarkdown(data, host);

  fs.writeFileSync(filePath, content, 'utf8');
  shell.showItemInFolder(filePath);
  return { ok: true, filePath };
});

// ─── IPC: export PNG (mindmap) ───────────────────────────────────────────────
ipcMain.handle('export-png', async (event, { dataUrl, host }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить карту как PNG',
    defaultPath: `mindmap-${host.replace(/[^a-z0-9]/gi, '_')}.png`,
    filters: [{ name: 'PNG', extensions: ['png'] }],
  });
  if (canceled || !filePath) return { ok: false };

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  shell.showItemInFolder(filePath);
  return { ok: true, filePath };
});

// ─── IPC: clipboard text (вне браузерной песочницы) ──────────────────────────
const { clipboard } = require('electron');
ipcMain.handle('clipboard-write', async (event, text) => {
  clipboard.writeText(String(text || ''));
  return { ok: true };
});
