const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
const LEAF_THRESHOLD = 20;

async function fetchSitemap(url) {
  const res = await axios.get(url, {
    timeout: 15000,
    headers: { 'User-Agent': 'SitemapAnalyzer/1.0' },
    maxContentLength: 50 * 1024 * 1024,
  });
  const parsed = parser.parse(res.data);

  if (parsed.sitemapindex) {
    const raw = parsed.sitemapindex.sitemap;
    const sitemaps = (Array.isArray(raw) ? raw : [raw])
      .filter(Boolean)
      .map((s) => ({ loc: String(s.loc || '').trim(), lastmod: s.lastmod || null }));
    return { isSitemapIndex: true, sitemaps, urls: [] };
  }

  if (parsed.urlset) {
    const raw = parsed.urlset.url;
    const urls = (Array.isArray(raw) ? raw : [raw])
      .filter(Boolean)
      .map((u) => ({
        loc: String(u.loc || '').trim(),
        lastmod: u.lastmod || null,
        changefreq: u.changefreq || null,
        priority: u.priority ?? null,
      }));
    return { isSitemapIndex: false, sitemaps: [], urls };
  }

  return { isSitemapIndex: false, sitemaps: [], urls: [] };
}

async function parseSitemapRecursive(rootUrl, concurrency = 10, onProgress = () => {}) {
  const visited = new Set();
  const allUrls = [];
  const seenLocs = new Set();

  async function processQueue(queue) {
    const running = [];
    const results = [];
    const iter = queue[Symbol.iterator]();

    async function worker() {
      for (const item of iter) {
        if (visited.has(item.url)) continue;
        visited.add(item.url);
        onProgress(`⬇ Загружаю: ${item.url}`);
        try {
          const data = await fetchSitemap(item.url);
          results.push({ ...item, data });

          if (data.isSitemapIndex && data.sitemaps.length > 0) {
            const subQueue = data.sitemaps
              .filter((s) => !visited.has(s.loc))
              .map((s) => ({ url: s.loc, lastmod: s.lastmod, parent: item.url }));
            const sub = await processQueue(subQueue);
            results.push(...sub);
          } else {
            let added = 0;
            for (const u of data.urls) {
              const key = normalizeUrl(u.loc);
              if (!seenLocs.has(key)) {
                seenLocs.add(key);
                allUrls.push({ ...u, sitemapUrl: item.url });
                added++;
              }
            }
            const skipped = data.urls.length - added;
            onProgress(`✓ ${added} URLs из ${item.url}` + (skipped > 0 ? ` (дублей пропущено: ${skipped})` : ''));
          }
        } catch (err) {
          onProgress(`✗ Ошибка: ${item.url} — ${err.message}`);
          results.push({ ...item, data: null, error: err.message });
        }
      }
    }

    for (let i = 0; i < concurrency; i++) running.push(worker());
    await Promise.all(running);
    return results;
  }

  const flatResults = await processQueue([{ url: rootUrl, parent: null }]);
  onProgress(`✅ Готово: ${allUrls.length} уникальных URLs из ${visited.size} сайтмапов`);

  const tree = buildTree(allUrls);

  // Дедупликация сайтмапов
  const seenSM = new Set();
  const dedupedSM = flatResults.filter(r => {
    if (seenSM.has(r.url)) return false;
    seenSM.add(r.url);
    return true;
  });

  return {
    rootUrl,
    totalUrls: allUrls.length,
    totalSitemaps: visited.size,
    sitemapsFlat: dedupedSM.map((r) => ({
      url: r.url,
      parent: r.parent,
      urlCount: r.data?.urls?.length ?? 0,
      isIndex: r.data?.isSitemapIndex ?? false,
      error: r.error ?? null,
    })),
    tree,
    allUrls,
  };
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return (u.hostname + path + u.search).toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

function buildTree(allUrls) {
  const root = { name: '/', path: '/', children: {}, urls: [], _count: 0 };

  for (const urlObj of allUrls) {
    try {
      const u = new URL(urlObj.loc);
      const segments = u.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);

      let node = root;
      node._count++;

      // Skip homepage (no path segments)
      if (segments.length === 0) continue;

      for (const seg of segments) {
        if (!node.children[seg]) {
          node.children[seg] = {
            name: seg,
            path: (node.path === '/' ? '' : node.path) + '/' + seg,
            children: {},
            urls: [],
            _count: 0,
          };
        }
        node = node.children[seg];
        node._count++;
      }
      node.urls.push(urlObj);
    } catch (_) {}
  }

  return serializeNode(root, 0);
}

function serializeNode(node, depth) {
  const children = Object.values(node.children).map((c) => serializeNode(c, depth + 1));
  const isFolder = children.length > 0;
  return {
    name: node.name,
    path: node.path,
    depth,
    totalCount: node._count,
    directUrls: node.urls,
    directUrlCount: node.urls.length,
    // Папка — это узел с дочерними сегментами пути.
    // Материал — это конечный узел (без вложенных сегментов).
    isFolder,
    isMaterial: !isFolder,
    isLeafGroup: !isFolder && node.urls.length > 0,
    collapsed: node.urls.length >= LEAF_THRESHOLD,
    children,
  };
}

module.exports = { parseSitemapRecursive };
