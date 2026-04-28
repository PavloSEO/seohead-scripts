'use strict';

/* ════════════════════════════════════════════════════════════════════
   Sitemap Analyzer — renderer (v1.2 · MD3)
   ─────────────────────────────────────────────────────────────────────
   • Tree view: папки раскрываются, материалы — конечные пункты.
   • Mindmap: bbox-layout без наложений, ретина-чёткая отрисовка,
     кликабельные узлы с контекстным меню, настраиваемые палитра,
     плотность и лимит материалов, экспорт PNG.
   ═══════════════════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────────────────
const LEAF_THRESHOLD = 20;
const AUTO_EXPAND_DEPTH = 5;
const AUTO_COLLAPSE_THRESHOLD = 7; // mindmap: auto-collapse folder nodes with > N folder children

let currentData = null;
let activeTab   = 'tree';
let searchQuery = '';
let ctxTarget   = null; // { url, node, parent, kind }

// ── DOM refs ─────────────────────────────────────────────────────────
const urlInput   = document.getElementById('url-input');
const concEl     = document.getElementById('concurrency');
const concVal    = document.getElementById('conc-val');
const parseBtn   = document.getElementById('parse-btn');
const logBox     = document.getElementById('log-box');
const loader     = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const welcome    = document.getElementById('welcome');
const mainToolbar= document.getElementById('main-toolbar');
const searchInput= document.getElementById('search-input');
const ctxMenu    = document.getElementById('ctx-menu');

concEl.addEventListener('input', () => { concVal.textContent = concEl.value; });

// ── Tabs (segmented buttons) ─────────────────────────────────────────
document.querySelectorAll('.seg-btn').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    showTab(activeTab);
  });
});

function showTab(tab) {
  ['tree','mindmap','sitemaps'].forEach(id => {
    const el = document.getElementById('panel-' + id);
    if (el) el.classList.toggle('hidden', id !== tab);
  });
  if (tab === 'mindmap' && currentData) renderMindmap(currentData.tree);
  document.getElementById('tree-ctrl-sec').style.display    = (tab === 'tree')    ? 'block' : 'none';
  document.getElementById('mindmap-ctrl-sec').style.display = (tab === 'mindmap') ? 'block' : 'none';
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  if (currentData) renderTreeView(currentData.tree);
});

// ── Parse pipeline ───────────────────────────────────────────────────
parseBtn.addEventListener('click', startParse);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') startParse(); });

async function startParse() {
  const url = urlInput.value.trim();
  if (!url) return showToast('Введите URL сайтмапа');

  parseBtn.disabled = true;
  loader.classList.add('visible');
  welcome.style.display = 'none';
  clearLog();
  addLog('🚀 Начинаю анализ: ' + url);

  window.api.removeProgressListeners();
  window.api.onProgress(msg => {
    addLog(msg);
    loaderText.textContent = msg.slice(0, 70) + (msg.length > 70 ? '…' : '');
  });

  const conc = parseInt(concEl.value, 10);
  const result = await window.api.parseSitemap(url, conc);

  loader.classList.remove('visible');
  parseBtn.disabled = false;

  if (!result.ok) { addLog('✗ ' + result.error, 'err'); showToast('Ошибка: ' + result.error); return; }

  currentData = result.data;
  addLog(`✅ Готово: ${currentData.totalUrls} URLs, ${currentData.totalSitemaps} сайтмапов`, 'done');

  initAutoCollapse(currentData.tree);
  mmScale = 1;

  renderStats(currentData);
  renderTreeView(currentData.tree);
  renderSitemapsTable(currentData.sitemapsFlat);

  mainToolbar.style.display = 'flex';
  showTab('tree');

  document.querySelectorAll('.seg-btn').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="tree"]').classList.add('active');
  activeTab = 'tree';

  document.getElementById('stats-sec').style.display = 'block';
  document.getElementById('export-sec').style.display = 'block';
  document.getElementById('tree-ctrl-sec').style.display = 'block';

  refreshPalettePreview();
}

// ── Log ──────────────────────────────────────────────────────────────
function clearLog() { logBox.innerHTML = ''; }
function addLog(msg, type = '') {
  const d = document.createElement('div');
  d.className = 'log-line' + (type ? ' ' + type : '');
  d.textContent = msg;
  logBox.appendChild(d);
  logBox.scrollTop = logBox.scrollHeight;
}

// ── Stats ────────────────────────────────────────────────────────────
function renderStats(data) {
  document.getElementById('s-urls').textContent     = fmt(data.totalUrls);
  document.getElementById('s-sitemaps').textContent = fmt(data.totalSitemaps);
  document.getElementById('s-depth').textContent    = maxDepth(data.tree);
  document.getElementById('s-sections').textContent = countSections(data.tree);
}
function maxDepth(n) {
  if (!n.children || !n.children.length) return n.depth;
  return Math.max(...n.children.map(maxDepth));
}
function countSections(n) {
  if (!n.children || !n.children.length) return n.isLeafGroup ? 1 : 0;
  return n.children.reduce((s, c) => s + countSections(c), 1);
}
function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

/* ════════════════════════════════════════════════════════════════════
   TREE VIEW
   ═══════════════════════════════════════════════════════════════════ */
function renderTreeView(root) {
  const container = document.getElementById('tree-root');
  container.innerHTML = '';
  container.appendChild(buildNodeEl(root, true));
}

function matchSearch(node) {
  if (!searchQuery) return true;
  if (node.path.toLowerCase().includes(searchQuery)) return true;
  if (node.directUrls && node.directUrls.some(u => u.loc.toLowerCase().includes(searchQuery))) return true;
  if (node.children && node.children.some(matchSearch)) return true;
  return false;
}

function buildNodeEl(node, isRoot = false) {
  const hasChildren = node.children && node.children.length > 0;
  const isFolder    = hasChildren;
  const isMaterial  = !hasChildren;

  if (searchQuery && !matchSearch(node)) return document.createDocumentFragment();

  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';

  let isOpen = isFolder && (isRoot || node.depth <= AUTO_EXPAND_DEPTH || !!searchQuery);

  const row = document.createElement('div');
  row.className = 'tree-row' + (isRoot ? ' selected' : '');
  row.style.paddingLeft = (10 + node.depth * 18) + 'px';

  const toggle = document.createElement('span');
  toggle.className = 'tree-toggle ' + (isFolder ? (isOpen ? 'open' : '') : 'leaf');
  toggle.textContent = '▶';

  const icon = document.createElement('span');
  icon.className = 'tree-icon';
  icon.textContent = isRoot ? '🌐' : isFolder ? '📁' : '📄';

  const name = document.createElement('span');
  const displayName = isRoot ? (getHost(currentData?.rootUrl || '') || node.path) : '/' + node.name;
  name.className = 'tree-name' + (isRoot ? ' root-name' : isMaterial ? ' leaf-name' : '');
  if (searchQuery && displayName.toLowerCase().includes(searchQuery)) {
    name.innerHTML = hl(displayName, searchQuery);
  } else {
    name.textContent = displayName;
  }

  const count = document.createElement('span');
  count.className = 'tree-count' + (node.totalCount >= 100 ? ' big' : '');
  count.textContent = fmt(node.totalCount);

  // show a subtle link-indicator on leaf nodes with a URL
  if (isMaterial && !isRoot) {
    const nodeUrl = getNodeUrl(node);
    if (nodeUrl) {
      row.title = nodeUrl;
      const link = document.createElement('span');
      link.className = 'tree-link-icon';
      link.textContent = '↗';
      row.appendChild(toggle);
      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(link);
      row.appendChild(count);
    } else {
      row.appendChild(toggle);
      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(count);
    }
  } else {
    row.appendChild(toggle);
    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(count);
  }
  wrapper.appendChild(row);

  row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ctxTarget = { node, url: null, kind: 'tree-node' };
    showCtxMenu(e.clientX, e.clientY);
  });

  const childrenEl = document.createElement('div');
  childrenEl.className = 'tree-children' + (isOpen ? '' : ' collapsed');

  if (isFolder) {
    for (const child of node.children) {
      if (searchQuery && !matchSearch(child)) continue;
      childrenEl.appendChild(buildNodeEl(child));
    }
  }

  wrapper.appendChild(childrenEl);

  row.addEventListener('click', () => {
    if (isFolder) {
      isOpen = !isOpen;
      childrenEl.classList.toggle('collapsed', !isOpen);
      toggle.classList.toggle('open', isOpen);
    } else if (isMaterial) {
      const nodeUrl = getNodeUrl(node);
      if (nodeUrl) window.api.openExternal(nodeUrl);
    }
  });

  return wrapper;
}

// expand / collapse all
document.getElementById('expand-all').addEventListener('click', () => {
  document.querySelectorAll('#tree-root .tree-children').forEach(el => el.classList.remove('collapsed'));
  document.querySelectorAll('#tree-root .tree-toggle:not(.leaf)').forEach(el => el.classList.add('open'));
});
document.getElementById('collapse-all').addEventListener('click', () => {
  const nodes   = [...document.querySelectorAll('#tree-root .tree-children')];
  nodes.slice(1).forEach(el => el.classList.add('collapsed'));
  const toggles = [...document.querySelectorAll('#tree-root .tree-toggle:not(.leaf)')];
  toggles.slice(1).forEach(el => el.classList.remove('open'));
});

/* ════════════════════════════════════════════════════════════════════
   CONTEXT MENU (общее для дерева и карты)
   ═══════════════════════════════════════════════════════════════════ */
function showCtxMenu(x, y) {
  const isMmNode = ctxTarget?.kind === 'mm-node' || ctxTarget?.kind === 'mm-summary';
  const ctxNode  = ctxTarget?.node;
  const hasFolderKidsCtx = isMmNode && ctxNode && folderKids(ctxNode).length > 0 && ctxNode.depth !== 0;
  const ctxCollapsed = hasFolderKidsCtx && isNodeCollapsed(ctxNode);
  const elSep  = document.getElementById('ctx-sep-collapse');
  const elColl = document.getElementById('ctx-mm-collapse');
  const elExp  = document.getElementById('ctx-mm-expand');
  if (elSep)  elSep.style.display  = hasFolderKidsCtx ? '' : 'none';
  if (elColl) elColl.style.display = (hasFolderKidsCtx && !ctxCollapsed) ? '' : 'none';
  if (elExp)  elExp.style.display  = (hasFolderKidsCtx && ctxCollapsed)  ? '' : 'none';

  ctxMenu.classList.add('visible');
  const mw = 260, mh = 260;
  ctxMenu.style.left = (x + mw > window.innerWidth ? x - mw : x) + 'px';
  ctxMenu.style.top  = (y + mh > window.innerHeight ? y - mh : y) + 'px';
}
document.addEventListener('click',   () => { ctxMenu.classList.remove('visible'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') ctxMenu.classList.remove('visible'); });

document.getElementById('ctx-open').addEventListener('click', () => {
  const url = ctxTarget?.url || (ctxTarget?.node && getNodeUrl(ctxTarget.node));
  if (url) window.api.openExternal(url);
  else showToast('Нет URL для открытия');
});

document.getElementById('ctx-copy-url').addEventListener('click', () => {
  const url = ctxTarget?.url || (ctxTarget?.node && getNodeUrl(ctxTarget.node));
  if (url) { copy(url); showToast('URL скопирован'); }
});

document.getElementById('ctx-copy-branch').addEventListener('click', () => {
  if (!ctxTarget?.node && !ctxTarget?.url) return;
  const text = ctxTarget.url || serializeNodeText(ctxTarget.node, 0);
  copy(text);
  showToast('Ветка скопирована');
});

document.getElementById('ctx-copy-md').addEventListener('click', () => {
  if (!ctxTarget?.node && !ctxTarget?.url) return;
  const text = ctxTarget.url
    ? `- \`${ctxTarget.url}\``
    : serializeNodeMarkdown(ctxTarget.node, 0);
  copy(text);
  showToast('Скопировано как Markdown');
});

document.getElementById('ctx-copy-urls-list').addEventListener('click', () => {
  if (!ctxTarget) return;
  const urls = ctxTarget.url ? [ctxTarget.url] : (ctxTarget.node ? collectAllUrls(ctxTarget.node) : []);
  copy(urls.join('\n'));
  showToast(`Скопировано ${urls.length} URL`);
});

document.getElementById('ctx-mm-collapse')?.addEventListener('click', () => {
  if (!ctxTarget?.node || !currentData) return;
  mmCollapsedPaths.add(ctxTarget.node.path);
  mmLayout = buildMindmapLayout(currentData.tree);
  drawMindmap();
});
document.getElementById('ctx-mm-expand')?.addEventListener('click', () => {
  if (!ctxTarget?.node || !currentData) return;
  mmCollapsedPaths.delete(ctxTarget.node.path);
  mmLayout = buildMindmapLayout(currentData.tree);
  drawMindmap();
});

function copy(text) {
  // используем IPC clipboard, чтобы работало даже без user gesture внутри canvas
  if (window.api && window.api.clipboardWrite) window.api.clipboardWrite(text);
  else if (navigator.clipboard) navigator.clipboard.writeText(text);
}

function getNodeUrl(node) {
  if (!node) return null;
  if (node.directUrls && node.directUrls.length > 0) return node.directUrls[0].loc;
  if (currentData) {
    try {
      const base = new URL(currentData.rootUrl);
      return base.origin + node.path;
    } catch {}
  }
  return null;
}

function serializeNodeText(node, indent) {
  const pad = '  '.repeat(indent);
  const lines = [`${pad}${node.path} (${node.totalCount} URLs)`];
  if (node.children) for (const c of node.children) lines.push(serializeNodeText(c, indent + 1));
  if (node.directUrls && node.directUrls.length <= 20) {
    for (const u of node.directUrls) lines.push(`${'  '.repeat(indent + 1)}${u.loc}`);
  } else if (node.directUrls && node.directUrls.length > 20) {
    lines.push(`${'  '.repeat(indent + 1)}… ${node.directUrls.length} URLs`);
  }
  return lines.join('\n');
}

function serializeNodeMarkdown(node, indent) {
  const pad   = '  '.repeat(indent);
  const isF   = node.children && node.children.length > 0;
  const icon  = node.depth === 0 ? '🌐' : isF ? '📁' : '📄';
  const label = node.depth === 0 ? (getHost(currentData?.rootUrl || '') || '/') : '/' + node.name;
  const lines = [`${pad}- ${icon} **${label}** — ${node.totalCount} URLs`];
  if (node.children) for (const c of node.children) lines.push(serializeNodeMarkdown(c, indent + 1));
  if (!isF && node.directUrls && node.directUrls.length > 0) {
    if (node.directUrls.length <= 20) {
      for (const u of node.directUrls) lines.push(`${'  '.repeat(indent + 1)}- \`${u.loc}\``);
    } else {
      lines.push(`${'  '.repeat(indent + 1)}- *(${node.directUrls.length} URLs)*`);
    }
  }
  return lines.join('\n');
}

function collectAllUrls(node) {
  const urls = (node.directUrls || []).map(u => u.loc);
  if (node.children) for (const c of node.children) urls.push(...collectAllUrls(c));
  return urls;
}

/* ════════════════════════════════════════════════════════════════════
   MINDMAP — Canvas
   ═══════════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('mindmap-canvas');
const ctx    = canvas.getContext('2d');

let mmScale     = 1;
let mmOffX      = 60;
let mmOffY      = 40;
let mmDragging  = false;
let mmDragMoved = false;
let mmDragStart = { x: 0, y: 0, ox: 0, oy: 0 };
let mmLayout    = null;
let mmHover     = null;     // { node, kind, parent }
let mmSelected  = null;
const mmCollapsedPaths = new Set(); // paths of manually/auto-collapsed mindmap nodes
let mmDpr       = window.devicePixelRatio || 1;

// ── Settings (UI-driven) ─────────────────────────────────────────────
const PALETTES = {
  purple : ['#d0bcff','#b69df8','#9a82db','#efb8c8','#ccc2dc','#e8def8','#7f67be'],
  ocean  : ['#80d8ff','#80cbc4','#90caf9','#9fa8da','#a5d6a7','#b39ddb','#4fc3f7'],
  sunset : ['#ffb77a','#ff8a65','#f6c90e','#efb8c8','#ffd180','#ff9e80','#ffab91'],
  forest : ['#6dd58c','#a5d6a7','#80cbc4','#dcedc8','#aed581','#c5e1a5','#81c784'],
  mono   : ['#cac4d0','#a8a3ad','#8a8590','#6e6973','#cdc7d2','#b0aab6','#928d99'],
};
const ROOT_COLOR = {
  purple:'#d0bcff', ocean:'#80d8ff', sunset:'#ffb77a',
  forest:'#a5d6a7', mono:'#cac4d0',
};
const DENSITY = {
  compact     : { H: 30, GAP: 10, COL: 190, LH: 20, LGAP: 3 },
  comfortable : { H: 36, GAP: 16, COL: 220, LH: 24, LGAP: 5 },
  spacious    : { H: 42, GAP: 22, COL: 250, LH: 28, LGAP: 7 },
};

let MM_PALETTE = 'purple';
let MM_DENSITY = 'comfortable';
let MM_MAT_LIMIT = 10;

let MM_H, MM_GAP, MM_COL, MM_LH, MM_LGAP;
applyDensity(MM_DENSITY);
function applyDensity(key) {
  const d = DENSITY[key]; MM_H = d.H; MM_GAP = d.GAP; MM_COL = d.COL; MM_LH = d.LH; MM_LGAP = d.LGAP;
}

// Hook up settings UI
document.getElementById('mm-palette').addEventListener('change', e => {
  MM_PALETTE = e.target.value; refreshPalettePreview();
  if (currentData && activeTab === 'mindmap') drawMindmap();
});
document.getElementById('mm-density').addEventListener('change', e => {
  MM_DENSITY = e.target.value; applyDensity(MM_DENSITY);
  if (currentData && activeTab === 'mindmap') renderMindmap(currentData.tree);
});
document.getElementById('mm-mat-limit').addEventListener('change', e => {
  MM_MAT_LIMIT = parseInt(e.target.value, 10);
  if (currentData && activeTab === 'mindmap') renderMindmap(currentData.tree);
});

function refreshPalettePreview() {
  const wrap = document.getElementById('palette-preview');
  if (!wrap) return;
  wrap.innerHTML = '';
  const pal = PALETTES[MM_PALETTE];
  for (const c of pal) {
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = c;
    sw.style.borderColor = c;
    wrap.appendChild(sw);
  }
}

// ── Layout: bbox-based, без наложений ────────────────────────────────
// Папка = узел с детьми; материал = лист.
function folderKids(node)   { return (node.children || []).filter(c => c.children && c.children.length > 0); }
function materialKids(node) { return (node.children || []).filter(c => !c.children || c.children.length === 0); }

// Сколько визуальных бэйджей материалов рисуем у узла.
// Если у узла есть дочерние ПАПКИ — не рисуем ни одного badge:
// folder-kids занимают ту же горизонтальную полосу, наложений быть не должно.
// Badges рисуются только у leaf-folder-узлов (папка без вложенных папок).
// > MM_MAT_LIMIT → один сводный бэйдж-счётчик.
function materialBadges(node) {
  if (folderKids(node).length > 0) return { items: [], summary: 0 };
  const m = materialKids(node);
  if (m.length === 0) return { items: [], summary: 0 };
  if (m.length > MM_MAT_LIMIT) return { items: [], summary: m.length };
  return { items: m, summary: 0 };
}

// ── Collapse / expand state ───────────────────────────────────────────
function isNodeCollapsed(node) { return mmCollapsedPaths.has(node.path); }

function effectiveFolderKids(node) {
  if (isNodeCollapsed(node)) return [];
  return folderKids(node);
}

function effectiveMaterialBadges(node) {
  if (isNodeCollapsed(node)) {
    // Show a single "folded" badge representing all hidden children
    return { items: [], summary: 0, folded: true, foldedCount: node.totalCount };
  }
  return materialBadges(node);
}

function initAutoCollapse(root) {
  mmCollapsedPaths.clear();
  function visit(node, depth) {
    const fk = folderKids(node);
    if (depth > 0 && fk.length > AUTO_COLLAPSE_THRESHOLD) {
      mmCollapsedPaths.add(node.path);
    } else {
      for (const c of fk) visit(c, depth + 1);
    }
  }
  visit(root, 0);
}

function materialsBlockH(node) {
  const eff = effectiveMaterialBadges(node);
  if (eff.folded) return MM_LH; // fold indicator badge
  const { items, summary } = eff;
  const n = summary > 0 ? 1 : items.length;
  if (n === 0) return 0;
  return n * MM_LH + (n - 1) * MM_LGAP;
}

// Высота bbox узла = max(собственная высота, высота блока детей-папок, высота материалов).
function subH(node) {
  const fk = effectiveFolderKids(node);
  const matH = materialsBlockH(node);
  if (fk.length === 0) return Math.max(MM_H, matH);
  let total = 0;
  for (const c of fk) total += subH(c);
  total += (fk.length - 1) * MM_GAP;
  return Math.max(total, MM_H, matH);
}

function buildMindmapLayout(root) {
  const pos = new Map();   // node -> { x, y } (top-left of node pill)

  function place(node, depth, topY) {
    const slotH = subH(node);
    const slotMid = topY + slotH / 2;

    // Узел всегда в центре своего слота — это даёт badges свободу
    // расходиться вверх/вниз и не залезать к соседям.
    pos.set(node, { x: depth * MM_COL, y: slotMid - MM_H / 2 });

    const fk = effectiveFolderKids(node);
    if (fk.length === 0) return;

    // Дети-папки центрированы внутри слота
    let childrenH = 0;
    for (const c of fk) childrenH += subH(c);
    childrenH += (fk.length - 1) * MM_GAP;

    let curY = slotMid - childrenH / 2;
    for (const c of fk) {
      place(c, depth + 1, curY);
      curY += subH(c) + MM_GAP;
    }
  }

  place(root, 0, 0);
  return { pos, totalH: subH(root) };
}

// ── DPR-aware canvas sizing ──────────────────────────────────────────
function resizeCanvasToWrap() {
  const wrap = document.getElementById('panel-mindmap');
  const w = Math.max(wrap.clientWidth  || 900, 100);
  const h = Math.max(wrap.clientHeight || 600, 100);
  mmDpr = window.devicePixelRatio || 1;
  canvas.width  = Math.round(w * mmDpr);
  canvas.height = Math.round(h * mmDpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
}
function cssW() { return parseInt(canvas.style.width,  10) || canvas.width;  }
function cssH() { return parseInt(canvas.style.height, 10) || canvas.height; }

function renderMindmap(root) {
  resizeCanvasToWrap();
  mmLayout = buildMindmapLayout(root);
  mmOffX = 60;
  mmOffY = Math.max(20, cssH() / 2 - mmLayout.totalH * mmScale / 2);
  drawMindmap();
}

function drawMindmap() {
  if (!mmLayout || !currentData) return;
  // сброс трансформации + DPR-scale
  ctx.setTransform(mmDpr, 0, 0, mmDpr, 0, 0);
  ctx.clearRect(0, 0, cssW(), cssH());

  // плоский «холст» (отдельный градиент рисует CSS под canvas)
  ctx.save();
  ctx.translate(mmOffX, mmOffY);
  ctx.scale(mmScale, mmScale);

  const { pos } = mmLayout;
  const root    = currentData.tree;

  const colorMap = buildColorMap(root);

  drawConns(root, pos, colorMap);
  drawAllNodes(root, pos, colorMap);

  ctx.restore();
}

function buildColorMap(root) {
  const map = new Map();
  const rootColor = ROOT_COLOR[MM_PALETTE] || '#d0bcff';
  map.set(root, rootColor);
  const pal = PALETTES[MM_PALETTE];
  let ci = 0;
  for (const c of (root.children || [])) {
    const color = pal[ci % pal.length];
    map.set(c, color);
    propagateColor(c, color, map);
    ci++;
  }
  return map;
}
function propagateColor(node, color, map) {
  for (const c of (node.children || [])) {
    if (!map.has(c)) map.set(c, color);
    propagateColor(c, color, map);
  }
}

function nodeW(node) {
  const isRoot = node.depth === 0;
  const txt    = isRoot ? (getHost(currentData?.rootUrl || '') || '/') : '/' + node.name;
  const base   = isRoot ? txt.length * 7.2 + 60 : txt.length * 6.6 + 60;
  return Math.min(Math.max(base, isRoot ? 170 : 130), 220);
}
function leafBW(node, summary) {
  if (summary && summary > 0) {
    const t = `📄 ${fmt(summary)} материалов`;
    return Math.min(Math.max(t.length * 6.4 + 30, 130), 210);
  }
  return Math.min(Math.max(node.name.length * 5.6 + 50, 110), 200);
}

// ── Connections ──────────────────────────────────────────────────────
function foldBadgeW(foldedCount) {
  const txt = `▶ ${fmt(foldedCount)} разделов`;
  return Math.min(Math.max(txt.length * 6.4 + 30, 130), 210);
}

function drawConns(node, pos, colorMap) {
  const p = pos.get(node);
  if (!p) return;
  const color = colorMap.get(node) || '#cac4d0';
  const fk    = effectiveFolderKids(node);
  const nw    = nodeW(node);

  for (const c of fk) {
    const cp = pos.get(c);
    if (!cp) continue;
    const x1 = p.x + nw, y1 = p.y + MM_H / 2;
    const x2 = cp.x,     y2 = cp.y + MM_H / 2;
    const cx = x1 + (x2 - x1) * 0.55;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cx, y1, cx, y2, x2, y2);
    ctx.strokeStyle = color + 'cc';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    drawConns(c, pos, colorMap);
  }

  const eff = effectiveMaterialBadges(node);

  // link to fold badge (collapsed node)
  if (eff.folded) {
    const lx = p.x + nw + 18;
    const ly = p.y + MM_H / 2;
    ctx.beginPath();
    ctx.moveTo(p.x + nw, ly);
    ctx.bezierCurveTo(p.x + nw + 8, ly, lx - 10, ly, lx, ly);
    ctx.strokeStyle = color + '66';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  // links to material badges
  const { items, summary } = eff;
  const badgeCount = summary > 0 ? 1 : items.length;
  if (badgeCount > 0) {
    const blockH = badgeCount * MM_LH + (badgeCount - 1) * MM_LGAP;
    const lx     = p.x + nw + 18;
    const startY = p.y + MM_H / 2 - blockH / 2;
    for (let i = 0; i < badgeCount; i++) {
      const ly  = startY + i * (MM_LH + MM_LGAP) + MM_LH / 2;
      const cx2 = lx - 10;
      ctx.beginPath();
      ctx.moveTo(p.x + nw, p.y + MM_H / 2);
      ctx.bezierCurveTo(p.x + nw + 8, p.y + MM_H / 2, cx2, ly, lx, ly);
      ctx.strokeStyle = color + '55';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// ── Nodes + material badges ──────────────────────────────────────────
function drawAllNodes(node, pos, colorMap) {
  const p = pos.get(node);
  if (!p) return;
  const color  = colorMap.get(node) || '#cac4d0';
  const isRoot = node.depth === 0;
  const nw     = nodeW(node);
  const collapsed = !isRoot && isNodeCollapsed(node);

  const isHover    = mmHover && mmHover.kind === 'node' && mmHover.node === node;
  const isSelected = mmSelected && mmSelected.kind === 'node' && mmSelected.node === node;

  // glow
  ctx.shadowColor   = color + (isHover || isRoot ? '88' : '44');
  ctx.shadowBlur    = isRoot ? 22 : isHover ? 16 : collapsed ? 14 : 10;
  ctx.shadowOffsetY = 2;

  ctx.beginPath();
  ctx.roundRect(p.x, p.y, nw, MM_H, MM_H / 2);
  ctx.fillStyle = isRoot ? color + 'ee'
                 : isSelected ? color + '50'
                 : isHover ? color + '38'
                 : collapsed ? color + '30'
                 : color + '22';
  ctx.fill();

  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0;

  // collapsed nodes get a dashed border to signal they can expand
  if (collapsed) {
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = color + 'dd';
    ctx.lineWidth   = 1.8;
  } else {
    ctx.strokeStyle = color + (isRoot ? 'ff' : isSelected ? 'ff' : 'cc');
    ctx.lineWidth   = isRoot ? 2 : isSelected ? 2 : 1.5;
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // count pill — show ▶ prefix when collapsed
  ctx.font = 'bold 10.5px "Roboto Flex", sans-serif';
  const cntTxt = (collapsed ? '▶ ' : '') + fmt(node.totalCount);
  const cntW   = ctx.measureText(cntTxt).width + 14;
  const px     = p.x + nw - cntW - 5;
  const py     = p.y + (MM_H - 18) / 2;
  ctx.beginPath();
  ctx.roundRect(px, py, cntW, 18, 9);
  ctx.fillStyle = color + (isRoot ? '55' : collapsed ? '55' : '44');
  ctx.fill();
  ctx.fillStyle = isRoot ? '#1c1b1f' : color + 'ff';
  ctx.fillText(cntTxt, px + 7, p.y + MM_H / 2 + 4);

  // label
  const label  = isRoot ? (getHost(currentData?.rootUrl || '') || '/') : '/' + node.name;
  const maxLW  = nw - cntW - 22;
  ctx.font     = `${isRoot ? 'bold 13' : '500 12'}px "Roboto Flex", sans-serif`;
  ctx.fillStyle = isRoot ? '#1c1b1f' : color + 'ff';
  ctx.fillText(truncLabel(label, maxLW), p.x + 14, p.y + MM_H / 2 + 4);

  const eff = effectiveMaterialBadges(node);

  // fold badge (when node is collapsed)
  if (eff.folded) {
    const lx  = p.x + nw + 18;
    const lw  = foldBadgeW(eff.foldedCount);
    const ly  = p.y + MM_H / 2 - MM_LH / 2;
    const txt = `▶ ${fmt(eff.foldedCount)} разделов`;
    const isFoldHover = mmHover && mmHover.kind === 'fold' && mmHover.node === node;
    ctx.font = '600 10.5px "Roboto Flex", sans-serif';
    ctx.beginPath();
    ctx.roundRect(lx, ly, lw, MM_LH, MM_LH / 2);
    ctx.fillStyle = color + (isFoldHover ? '30' : '1a');
    ctx.fill();
    ctx.strokeStyle = color + '88';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color + 'ee';
    ctx.fillText(truncLabel(txt, lw - 14), lx + 8, ly + MM_LH / 2 + 3.6);
  } else {
    const { items, summary } = eff;
    if (summary > 0) {
      const lx = p.x + nw + 18;
      const ly = p.y + MM_H / 2 - MM_LH / 2;
      const txt = `📄 ${fmt(summary)} материалов`;
      ctx.font = '500 10.5px "Roboto Flex", sans-serif';
      const lw = leafBW(null, summary);
      const isSumHover = mmHover && mmHover.kind === 'summary' && mmHover.parent === node;
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, MM_LH, MM_LH / 2);
      ctx.fillStyle = color + (isSumHover ? '28' : '14');
      ctx.fill();
      ctx.strokeStyle = color + '55';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color + 'cc';
      ctx.fillText(truncLabel(txt, lw - 14), lx + 8, ly + MM_LH / 2 + 3.6);
    } else if (items.length > 0) {
      const blockH = items.length * MM_LH + (items.length - 1) * MM_LGAP;
      const lx     = p.x + nw + 18;
      const startY = p.y + MM_H / 2 - blockH / 2;
      items.forEach((lc, i) => {
        const ly = startY + i * (MM_LH + MM_LGAP);
        const lw = leafBW(lc);
        const isMHover    = mmHover    && mmHover.kind === 'material'    && mmHover.node === lc;
        const isMSelected = mmSelected && mmSelected.kind === 'material' && mmSelected.node === lc;
        ctx.beginPath();
        ctx.roundRect(lx, ly, lw, MM_LH, MM_LH / 2);
        ctx.fillStyle = isMSelected ? color + '50' : isMHover ? color + '30' : color + '18';
        ctx.fill();
        ctx.strokeStyle = color + (isMSelected ? 'cc' : '55');
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font      = '500 10px "Roboto Flex", sans-serif';
        ctx.fillStyle = color + 'd6';
        ctx.fillText(truncLabel('/' + lc.name, lw - 16), lx + 8, ly + MM_LH / 2 + 3.4);
      });
    }
  }

  for (const c of effectiveFolderKids(node)) drawAllNodes(c, pos, colorMap);
}

function truncLabel(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 2 && ctx.measureText(text + '\u2026').width > maxW) text = text.slice(0, -1);
  return text + '\u2026';
}

// ── Hit testing ──────────────────────────────────────────────────────
// Возвращает { kind: 'node'|'material'|'summary'|'fold', node, parent? } или null.
function hitTest(cssX, cssY) {
  if (!mmLayout) return null;
  const x = (cssX - mmOffX) / mmScale;
  const y = (cssY - mmOffY) / mmScale;

  for (const [node, p] of mmLayout.pos) {
    const nw = nodeW(node);
    // 1) сам узел
    if (x >= p.x && x <= p.x + nw && y >= p.y && y <= p.y + MM_H) {
      return { kind: 'node', node };
    }
    // 2) badges (fold / summary / material)
    const eff = effectiveMaterialBadges(node);
    if (eff.folded) {
      const lx = p.x + nw + 18;
      const lw = foldBadgeW(eff.foldedCount);
      const ly = p.y + MM_H / 2 - MM_LH / 2;
      if (x >= lx && x <= lx + lw && y >= ly && y <= ly + MM_LH) {
        return { kind: 'fold', node };
      }
    } else if (eff.summary > 0) {
      const lx = p.x + nw + 18;
      const ly = p.y + MM_H / 2 - MM_LH / 2;
      const lw = leafBW(null, eff.summary);
      if (x >= lx && x <= lx + lw && y >= ly && y <= ly + MM_LH) {
        return { kind: 'summary', parent: node };
      }
    } else if (eff.items.length > 0) {
      const blockH = eff.items.length * MM_LH + (eff.items.length - 1) * MM_LGAP;
      const lx     = p.x + nw + 18;
      const startY = p.y + MM_H / 2 - blockH / 2;
      for (let i = 0; i < eff.items.length; i++) {
        const ly = startY + i * (MM_LH + MM_LGAP);
        const lw = leafBW(eff.items[i]);
        if (x >= lx && x <= lx + lw && y >= ly && y <= ly + MM_LH) {
          return { kind: 'material', node: eff.items[i], parent: node };
        }
      }
    }
  }
  return null;
}

// ── Pan, zoom, hover, click, contextmenu ─────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  mmDragging = true;
  mmDragMoved = false;
  mmDragStart = { x: e.clientX, y: e.clientY, ox: mmOffX, oy: mmOffY };
  canvas.classList.add('dragging');
});

window.addEventListener('mousemove', e => {
  if (mmDragging) {
    const dx = e.clientX - mmDragStart.x;
    const dy = e.clientY - mmDragStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) mmDragMoved = true;
    mmOffX = mmDragStart.ox + dx;
    mmOffY = mmDragStart.oy + dy;
    drawMindmap();
    return;
  }
  // hover
  if (activeTab !== 'mindmap' || !mmLayout) return;
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  if (cx < 0 || cy < 0 || cx > rect.width || cy > rect.height) return;
  const hit = hitTest(cx, cy);
  const same = (a, b) => (!a && !b) || (a && b && a.kind === b.kind && a.node === b.node && a.parent === b.parent);
  if (!same(hit, mmHover)) {
    mmHover = hit;
    canvas.style.cursor = hit ? (hit.kind === 'node' && folderKids(hit.node).length > 0 && hit.node.depth !== 0 ? 'pointer' : 'pointer') : (mmDragging ? 'grabbing' : 'grab');
    drawMindmap();
  }
});

window.addEventListener('mouseup', e => {
  if (!mmDragging) return;
  mmDragging = false;
  canvas.classList.remove('dragging');
  if (mmDragMoved) return; // это был drag, не click

  // Click: toggle collapse (folder nodes) or select
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  if (cx < 0 || cy < 0 || cx > rect.width || cy > rect.height) return;
  const hit = hitTest(cx, cy);
  if (hit) {
    if (hit.kind === 'node') {
      const hasFolderKids = folderKids(hit.node).length > 0;
      if (hasFolderKids && hit.node.depth !== 0) {
        if (mmCollapsedPaths.has(hit.node.path)) {
          mmCollapsedPaths.delete(hit.node.path);
        } else {
          mmCollapsedPaths.add(hit.node.path);
        }
        mmLayout = buildMindmapLayout(currentData.tree);
      }
      mmSelected = hit;
      drawMindmap();
    } else if (hit.kind === 'fold') {
      // clicking fold badge expands the node
      mmCollapsedPaths.delete(hit.node.path);
      mmLayout = buildMindmapLayout(currentData.tree);
      mmSelected = { kind: 'node', node: hit.node };
      drawMindmap();
    } else if (hit.kind === 'material') {
      mmSelected = hit;
      drawMindmap();
      const url = getNodeUrl(hit.node);
      if (url) window.api.openExternal(url);
    }
  } else {
    if (mmSelected) { mmSelected = null; drawMindmap(); }
  }
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const hit  = hitTest(e.clientX - rect.left, e.clientY - rect.top);
  if (!hit) {
    ctxTarget = null;
    return;
  }
  if (hit.kind === 'node') {
    ctxTarget = { node: hit.node, url: null, kind: 'mm-node' };
    mmSelected = hit;
  } else if (hit.kind === 'fold') {
    ctxTarget = { node: hit.node, url: null, kind: 'mm-node' };
    mmSelected = { kind: 'node', node: hit.node };
  } else if (hit.kind === 'material') {
    ctxTarget = { node: hit.node, url: getNodeUrl(hit.node), kind: 'mm-material' };
    mmSelected = hit;
  } else if (hit.kind === 'summary') {
    ctxTarget = { node: hit.parent, url: null, kind: 'mm-summary' };
    mmSelected = { kind: 'node', node: hit.parent };
  }
  drawMindmap();
  showCtxMenu(e.clientX, e.clientY);
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;

  const oldScale = mmScale;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  mmScale = Math.max(0.2, Math.min(3, mmScale * delta));

  // зум к курсору
  const k = mmScale / oldScale;
  mmOffX = cx - (cx - mmOffX) * k;
  mmOffY = cy - (cy - mmOffY) * k;
  drawMindmap();
}, { passive: false });

// Mindmap controls
document.getElementById('mm-fit').addEventListener('click', () => {
  if (!currentData) return;
  fitMindmap();
});
document.getElementById('mm-zoomin').addEventListener('click', () => {
  mmScale = Math.min(3, mmScale * 1.2); drawMindmap();
});
document.getElementById('mm-zoomout').addEventListener('click', () => {
  mmScale = Math.max(0.2, mmScale * 0.8); drawMindmap();
});
document.getElementById('mm-expand-all')?.addEventListener('click', () => {
  if (!currentData) return;
  mmCollapsedPaths.clear();
  mmLayout = buildMindmapLayout(currentData.tree);
  drawMindmap();
});
document.getElementById('mm-collapse-all')?.addEventListener('click', () => {
  if (!currentData) return;
  function collapseAll(node, depth) {
    const fk = folderKids(node);
    if (depth > 0 && fk.length > 0) mmCollapsedPaths.add(node.path);
    for (const c of fk) collapseAll(c, depth + 1);
  }
  mmCollapsedPaths.clear();
  collapseAll(currentData.tree, 0);
  mmLayout = buildMindmapLayout(currentData.tree);
  drawMindmap();
});

function fitMindmap() {
  if (!mmLayout) return;
  // Определяем bounding box всех узлов (с учётом материалов справа)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [node, p] of mmLayout.pos) {
    const nw = nodeW(node);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + nw);
    maxY = Math.max(maxY, p.y + MM_H);
    const eff = effectiveMaterialBadges(node);
    if (eff.folded) {
      const lx = p.x + nw + 18;
      maxX = Math.max(maxX, lx + foldBadgeW(eff.foldedCount));
    } else if (eff.summary > 0 || eff.items.length > 0) {
      const badgeCount = eff.summary > 0 ? 1 : eff.items.length;
      const blockH = badgeCount * MM_LH + (badgeCount - 1) * MM_LGAP;
      const lx = p.x + nw + 18;
      const startY = p.y + MM_H / 2 - blockH / 2;
      const lwMax = eff.summary > 0 ? leafBW(null, eff.summary) : Math.max(...eff.items.map(i => leafBW(i)));
      maxX = Math.max(maxX, lx + lwMax);
      minY = Math.min(minY, startY);
      maxY = Math.max(maxY, startY + blockH);
    }
  }
  const w = maxX - minX, h = maxY - minY;
  const padding = 60;
  const sx = (cssW() - padding * 2) / w;
  const sy = (cssH() - padding * 2) / h;
  mmScale = Math.max(0.2, Math.min(3, Math.min(sx, sy)));
  mmOffX = padding - minX * mmScale + (cssW() - padding * 2 - w * mmScale) / 2;
  mmOffY = padding - minY * mmScale + (cssH() - padding * 2 - h * mmScale) / 2;
  drawMindmap();
}

// Resize handling
new ResizeObserver(() => {
  if (activeTab === 'mindmap' && currentData) {
    resizeCanvasToWrap();
    drawMindmap();
  }
}).observe(document.getElementById('panel-mindmap'));

window.addEventListener('resize', () => {
  if (activeTab === 'mindmap' && currentData) {
    resizeCanvasToWrap();
    drawMindmap();
  }
});

/* ════════════════════════════════════════════════════════════════════
   PNG EXPORT (off-screen canvas, full layout, hi-res)
   ═══════════════════════════════════════════════════════════════════ */
async function exportMindmapPng() {
  if (!currentData || !mmLayout) { showToast('Сначала откройте карту'); return; }

  // bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [node, p] of mmLayout.pos) {
    const nw = nodeW(node);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + nw);
    maxY = Math.max(maxY, p.y + MM_H);
    const eff = effectiveMaterialBadges(node);
    if (eff.folded) {
      const lx = p.x + nw + 18;
      maxX = Math.max(maxX, lx + foldBadgeW(eff.foldedCount));
    } else if (eff.summary > 0 || eff.items.length > 0) {
      const badgeCount = eff.summary > 0 ? 1 : eff.items.length;
      const blockH = badgeCount * MM_LH + (badgeCount - 1) * MM_LGAP;
      const lx = p.x + nw + 18;
      const startY = p.y + MM_H / 2 - blockH / 2;
      const lwMax = eff.summary > 0 ? leafBW(null, eff.summary) : Math.max(...eff.items.map(i => leafBW(i)));
      maxX = Math.max(maxX, lx + lwMax);
      minY = Math.min(minY, startY);
      maxY = Math.max(maxY, startY + blockH);
    }
  }
  const PAD = 80;
  const W = Math.ceil((maxX - minX) + PAD * 2);
  const H = Math.ceil((maxY - minY) + PAD * 2);
  const SCALE = 2; // hi-res

  // временно подменяем глобальный ctx на off-screen, перерисовываем
  const off  = document.createElement('canvas');
  off.width  = W * SCALE;
  off.height = H * SCALE;
  const offCtx = off.getContext('2d');

  // подменим глобальный ctx и canvas (renderer пишет в них)
  const realCanvas = canvas;
  const realCtx    = ctx;

  // background
  offCtx.fillStyle = '#0e0c12';
  offCtx.fillRect(0, 0, off.width, off.height);

  // лёгкое радиальное свечение по центру
  const grd = offCtx.createRadialGradient(off.width/2, off.height/2, 0, off.width/2, off.height/2, Math.max(off.width,off.height)/2);
  grd.addColorStop(0, '#1d1b20');
  grd.addColorStop(1, '#0e0c12');
  offCtx.fillStyle = grd;
  offCtx.fillRect(0, 0, off.width, off.height);

  // подменяем глобалы на off-screen
  // (renderer.js использует переменные `ctx` и `canvas` в замыкании;
  //  чтобы не дублировать тонну кода, сделаем простое переназначение через прокси.)
  // Используем proxy-подход: рисуем напрямую методами из drawAllNodes/drawConns,
  // но для этого нужен общий ctx. Проще: меняем оригинальные ссылки временно.

  // Хак: оригинальные `ctx` и `canvas` объявлены через `const`. Поэтому мы
  // не можем переназначить. Вместо этого делаем КОПИЮ функций отрисовки,
  // принимающих ctx как параметр.
  drawMindmapTo(offCtx, SCALE, PAD, minX, minY, W, H);

  const dataUrl = off.toDataURL('image/png');
  const host = getHost(currentData.rootUrl);
  const r = await window.api.exportPng(dataUrl, host);
  if (r.ok) showToast('🖼 PNG сохранён');
}

function drawMindmapTo(c, scale, pad, minX, minY, W, H) {
  // основной transform
  c.setTransform(scale, 0, 0, scale, scale * (pad - minX), scale * (pad - minY));

  const root = currentData.tree;
  const colorMap = buildColorMap(root);
  const { pos } = mmLayout;

  // ── connections ──────────────────────────────────────────────────
  function drawConnsTo(node) {
    const p = pos.get(node);
    if (!p) return;
    const color = colorMap.get(node) || '#cac4d0';
    const fk    = effectiveFolderKids(node);
    const nw    = nodeW(node);

    for (const cc of fk) {
      const cp = pos.get(cc);
      if (!cp) continue;
      const x1 = p.x + nw, y1 = p.y + MM_H / 2;
      const x2 = cp.x,     y2 = cp.y + MM_H / 2;
      const cx = x1 + (x2 - x1) * 0.55;
      c.beginPath();
      c.moveTo(x1, y1);
      c.bezierCurveTo(cx, y1, cx, y2, x2, y2);
      c.strokeStyle = color + 'cc';
      c.lineWidth = 1.8;
      c.stroke();
      drawConnsTo(cc);
    }
    const eff = effectiveMaterialBadges(node);
    if (eff.folded) {
      const lx = p.x + nw + 18;
      const ly = p.y + MM_H / 2;
      c.beginPath();
      c.moveTo(p.x + nw, ly);
      c.bezierCurveTo(p.x + nw + 8, ly, lx - 10, ly, lx, ly);
      c.strokeStyle = color + '66';
      c.lineWidth = 1.2;
      c.setLineDash([4, 3]);
      c.stroke();
      c.setLineDash([]);
    } else {
      const { items, summary } = eff;
      const badgeCount = summary > 0 ? 1 : items.length;
      if (badgeCount > 0) {
        const blockH = badgeCount * MM_LH + (badgeCount - 1) * MM_LGAP;
        const lx     = p.x + nw + 18;
        const startY = p.y + MM_H / 2 - blockH / 2;
        for (let i = 0; i < badgeCount; i++) {
          const ly  = startY + i * (MM_LH + MM_LGAP) + MM_LH / 2;
          const cx2 = lx - 10;
          c.beginPath();
          c.moveTo(p.x + nw, p.y + MM_H / 2);
          c.bezierCurveTo(p.x + nw + 8, p.y + MM_H / 2, cx2, ly, lx, ly);
          c.strokeStyle = color + '55';
          c.lineWidth = 1;
          c.stroke();
        }
      }
    }
  }

  function drawNodesTo(node) {
    const p = pos.get(node);
    if (!p) return;
    const color  = colorMap.get(node) || '#cac4d0';
    const isRoot = node.depth === 0;
    const nw     = nodeW(node);

    const collapsed = !isRoot && isNodeCollapsed(node);
    c.shadowColor = color + (isRoot ? '88' : '44');
    c.shadowBlur  = isRoot ? 22 : collapsed ? 14 : 10;
    c.shadowOffsetY = 2;
    c.beginPath();
    c.roundRect(p.x, p.y, nw, MM_H, MM_H / 2);
    c.fillStyle = isRoot ? color + 'ee' : collapsed ? color + '30' : color + '22';
    c.fill();
    c.shadowBlur = 0; c.shadowColor = 'transparent'; c.shadowOffsetY = 0;
    if (collapsed) {
      c.setLineDash([5, 3]);
      c.strokeStyle = color + 'dd';
      c.lineWidth = 1.8;
    } else {
      c.strokeStyle = color + (isRoot ? 'ff' : 'cc');
      c.lineWidth = isRoot ? 2 : 1.5;
    }
    c.stroke();
    c.setLineDash([]);
    c.font = 'bold 10.5px "Roboto Flex", sans-serif';
    const cntTxt = (collapsed ? '▶ ' : '') + fmt(node.totalCount);
    const cntW   = c.measureText(cntTxt).width + 14;
    const px     = p.x + nw - cntW - 5;
    const py     = p.y + (MM_H - 18) / 2;
    c.beginPath();
    c.roundRect(px, py, cntW, 18, 9);
    c.fillStyle = color + (isRoot ? '55' : collapsed ? '55' : '44');
    c.fill();
    c.fillStyle = isRoot ? '#1c1b1f' : color + 'ff';
    c.fillText(cntTxt, px + 7, p.y + MM_H / 2 + 4);

    const label  = isRoot ? (getHost(currentData?.rootUrl || '') || '/') : '/' + node.name;
    const maxLW  = nw - cntW - 22;
    c.font = `${isRoot ? 'bold 13' : '500 12'}px "Roboto Flex", sans-serif`;
    c.fillStyle = isRoot ? '#1c1b1f' : color + 'ff';
    c.fillText(truncLabelTo(c, label, maxLW), p.x + 14, p.y + MM_H / 2 + 4);

    const eff = effectiveMaterialBadges(node);
    if (eff.folded) {
      const lx  = p.x + nw + 18;
      const lw  = foldBadgeW(eff.foldedCount);
      const ly  = p.y + MM_H / 2 - MM_LH / 2;
      const txt = `▶ ${fmt(eff.foldedCount)} разделов`;
      c.font = '600 10.5px "Roboto Flex", sans-serif';
      c.beginPath();
      c.roundRect(lx, ly, lw, MM_LH, MM_LH / 2);
      c.fillStyle = color + '1a';
      c.fill();
      c.strokeStyle = color + '88';
      c.lineWidth = 1.5;
      c.setLineDash([4, 3]);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = color + 'ee';
      c.fillText(truncLabelTo(c, txt, lw - 14), lx + 8, ly + MM_LH / 2 + 3.6);
    } else {
      const { items, summary } = eff;
      if (summary > 0) {
        const lx = p.x + nw + 18;
        const ly = p.y + MM_H / 2 - MM_LH / 2;
        const txt = `📄 ${fmt(summary)} материалов`;
        c.font = '500 10.5px "Roboto Flex", sans-serif';
        const lw = leafBW(null, summary);
        c.beginPath();
        c.roundRect(lx, ly, lw, MM_LH, MM_LH / 2);
        c.fillStyle = color + '14';
        c.fill();
        c.strokeStyle = color + '55';
        c.lineWidth = 1;
        c.setLineDash([3, 3]);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = color + 'cc';
        c.fillText(truncLabelTo(c, txt, lw - 14), lx + 8, ly + MM_LH / 2 + 3.6);
      } else if (items.length > 0) {
        const blockH = items.length * MM_LH + (items.length - 1) * MM_LGAP;
        const lx     = p.x + nw + 18;
        const startY = p.y + MM_H / 2 - blockH / 2;
        items.forEach((lc, i) => {
          const ly = startY + i * (MM_LH + MM_LGAP);
          const lw = leafBW(lc);
          c.beginPath();
          c.roundRect(lx, ly, lw, MM_LH, MM_LH / 2);
          c.fillStyle = color + '18';
          c.fill();
          c.strokeStyle = color + '55';
          c.lineWidth = 1;
          c.stroke();
          c.font = '500 10px "Roboto Flex", sans-serif';
          c.fillStyle = color + 'd6';
          c.fillText(truncLabelTo(c, '/' + lc.name, lw - 16), lx + 8, ly + MM_LH / 2 + 3.4);
        });
      }
    }
    for (const cc of effectiveFolderKids(node)) drawNodesTo(cc);
  }

  drawConnsTo(root);
  drawNodesTo(root);
}
function truncLabelTo(c, text, maxW) {
  if (c.measureText(text).width <= maxW) return text;
  while (text.length > 2 && c.measureText(text + '\u2026').width > maxW) text = text.slice(0, -1);
  return text + '\u2026';
}

/* ════════════════════════════════════════════════════════════════════
   SITEMAPS TABLE
   ═══════════════════════════════════════════════════════════════════ */
function renderSitemapsTable(sitemaps) {
  const tbody = document.getElementById('sm-tbody');
  tbody.innerHTML = '';
  for (const s of sitemaps) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="url-mono">${esc(s.url)}</span></td>
      <td>${s.error ? '<span class="badge badge-err">❌ Ошибка</span>' : s.isIndex ? '<span class="badge badge-idx">🗂 Индекс</span>' : '<span class="badge badge-url">📄 URLset</span>'}</td>
      <td style="text-align:right">${s.urlCount > 0 ? fmt(s.urlCount) : (s.error ? '—' : '0')}</td>
      <td><span class="url-mono" style="opacity:.5">${esc(s.parent || '—')}</span></td>
    `;
    tr.addEventListener('contextmenu', e => {
      e.preventDefault();
      ctxTarget = { url: s.url, node: null, kind: 'sitemap' };
      showCtxMenu(e.clientX, e.clientY);
    });
    tbody.appendChild(tr);
  }
}

/* ════════════════════════════════════════════════════════════════════
   EXPORT BUTTONS
   ═══════════════════════════════════════════════════════════════════ */
document.getElementById('export-md').addEventListener('click', async () => {
  if (!currentData) return;
  const r = await window.api.exportData('md', currentData, getHost(currentData.rootUrl));
  if (r.ok) showToast('✅ Markdown сохранён');
});
document.getElementById('export-json').addEventListener('click', async () => {
  if (!currentData) return;
  const r = await window.api.exportData('json', currentData, getHost(currentData.rootUrl));
  if (r.ok) showToast('✅ JSON сохранён');
});
document.getElementById('export-png').addEventListener('click', () => {
  exportMindmapPng();
});

/* ════════════════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════════════ */
function hl(text, query) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<span class="highlight">' + esc(text.slice(i, i + query.length)) + '</span>' + esc(text.slice(i + query.length));
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function getHost(str) { try { return new URL(str).hostname; } catch { return str; } }

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// init palette preview at load
refreshPalettePreview();
