const https = require('https');
const http  = require('http');

/* ── HTTP fetch with redirect follow ──────────────────────────────────────── */
function fetchUrl(url, timeoutMs = 20000, redirectCount = 0) {
    if (redirectCount > 5) return Promise.reject(new Error(`Too many redirects: ${url}`));
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SitemapAnalyser/1.0)',
                'Accept':     'application/xml,text/xml,*/*',
                'Accept-Encoding': 'identity',
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const next = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : new URL(res.headers.location, url).href;
                res.resume();
                fetchUrl(next, timeoutMs, redirectCount + 1).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
            res.on('error', reject);
        });
        req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
        req.on('error', reject);
    });
}

/* ── XML helpers ──────────────────────────────────────────────────────────── */
function decodeXmlEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function extractTagContent(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m  = re.exec(xml);
    return m ? decodeXmlEntities(m[1].trim()) : null;
}

function isIndexSitemap(xml) {
    return /<sitemapindex[\s>]/i.test(xml);
}

function parseSitemapIndex(xml) {
    const items = [];
    const re    = /<sitemap[\s>]([\s\S]*?)<\/sitemap>/gi;
    let m;
    while ((m = re.exec(xml)) !== null) {
        const loc = extractTagContent(m[1], 'loc');
        if (loc) items.push({ loc, lastmod: extractTagContent(m[1], 'lastmod') });
    }
    return items;
}

function parseUrlset(xml) {
    const urls = [];
    const re   = /<url[\s>]([\s\S]*?)<\/url>/gi;
    let m;
    while ((m = re.exec(xml)) !== null) {
        const block = m[1];
        const loc   = extractTagContent(block, 'loc');
        if (!loc) continue;
        urls.push({
            loc,
            lastmod:    extractTagContent(block, 'lastmod'),
            changefreq: extractTagContent(block, 'changefreq'),
            priority:   parseFloat(extractTagContent(block, 'priority') || '') || null,
        });
    }
    return urls;
}

/* ── Concurrent promise pool ──────────────────────────────────────────────── */
async function runPool(tasks, concurrency) {
    let i = 0;
    const worker = async () => {
        while (i < tasks.length) {
            await tasks[i++]();
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}

/* ── Main crawl entry point ───────────────────────────────────────────────── */
async function crawl(rootUrl, { concurrency = 3, onProgress = null } = {}) {
    const visited  = new Set();
    const queue    = [rootUrl];
    const sitemaps = [];
    const allUrls  = [];
    const errors   = [];

    while (queue.length > 0) {
        const batch = queue.splice(0, concurrency);

        await runPool(batch.map(url => async () => {
            if (visited.has(url)) return;
            visited.add(url);

            onProgress?.({ type: 'fetching', url, visitedCount: visited.size });

            try {
                const xml = await fetchUrl(url);

                if (isIndexSitemap(xml)) {
                    const children = parseSitemapIndex(xml);
                    sitemaps.push({ url, type: 'index', childCount: children.length });
                    onProgress?.({ type: 'index', url, childCount: children.length });
                    for (const { loc } of children) {
                        if (!visited.has(loc)) queue.push(loc);
                    }
                } else {
                    const urls = parseUrlset(xml);
                    sitemaps.push({ url, type: 'urlset', urlCount: urls.length });
                    allUrls.push(...urls);
                    onProgress?.({ type: 'urlset', url, urlCount: urls.length, totalUrls: allUrls.length });
                }
            } catch (e) {
                errors.push({ url, error: e.message });
                onProgress?.({ type: 'error', url, error: e.message });
            }
        }), concurrency);
    }

    return { sitemaps, urls: allUrls, errors };
}

module.exports = { crawl };
