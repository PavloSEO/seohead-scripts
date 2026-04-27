'use strict';

const https = require('https');
const http  = require('http');
const zlib  = require('zlib');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: true,
    allowBooleanAttributes: true,
    removeNSPrefix: true,
});

/* ── HTTP fetch with redirect follow + gzip support ──────────────────────── */
function fetchUrl(url, timeoutMs = 25000, redirectCount = 0) {
    if (redirectCount > 8) return Promise.reject(new Error(`Too many redirects: ${url}`));
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(url, {
            headers: {
                'User-Agent':      'Mozilla/5.0 (compatible; SitemapAnalyzer/2.0)',
                'Accept':          'application/xml,text/xml,application/gzip,*/*',
                'Accept-Encoding': 'gzip, deflate, identity',
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

            const enc = (res.headers['content-encoding'] || '').toLowerCase();
            let stream = res;
            if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
            else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());

            const chunks = [];
            stream.on('data', c => chunks.push(c));
            stream.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
            stream.on('error', reject);
        });
        req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
        req.on('error', reject);
    });
}

/* ── XML parsing (fast-xml-parser) ───────────────────────────────────────── */
function parseSitemap(xml) {
    let parsed;
    try { parsed = xmlParser.parse(xml); }
    catch (e) { throw new Error(`XML parse error: ${e.message}`); }

    if (parsed.sitemapindex) {
        const raw = parsed.sitemapindex.sitemap;
        const sitemaps = (Array.isArray(raw) ? raw : [raw])
            .filter(Boolean)
            .map(s => ({
                loc:     String(s.loc || s['#text'] || '').trim(),
                lastmod: s.lastmod || null,
            }))
            .filter(s => s.loc);
        return { isSitemapIndex: true, sitemaps, urls: [] };
    }

    if (parsed.urlset) {
        const raw = parsed.urlset.url;
        const urls = (Array.isArray(raw) ? raw : [raw])
            .filter(Boolean)
            .map(u => ({
                loc:        String(u.loc || u['#text'] || '').trim(),
                lastmod:    u.lastmod    || null,
                changefreq: u.changefreq || null,
                priority:   u.priority   != null ? parseFloat(u.priority) || null : null,
            }))
            .filter(u => u.loc);
        return { isSitemapIndex: false, sitemaps: [], urls };
    }

    return { isSitemapIndex: false, sitemaps: [], urls: [] };
}

/* ── Concurrent worker pool ───────────────────────────────────────────────── */
async function runPool(tasks, concurrency) {
    let i = 0;
    const worker = async () => {
        while (i < tasks.length) await tasks[i++]();
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}

/* ── Main crawl entry point ───────────────────────────────────────────────── */
async function crawl(rootUrl, { concurrency = 5, onProgress = null } = {}) {
    const visited  = new Set();
    const queue    = [rootUrl];
    const sitemaps = [];
    const seenLocs = new Set();
    const allUrls  = [];
    const errors   = [];

    while (queue.length > 0) {
        const batch = queue.splice(0, concurrency);

        await runPool(batch.map(url => async () => {
            if (visited.has(url)) return;
            visited.add(url);

            onProgress?.({ type: 'fetching', url, visitedCount: visited.size });

            try {
                const xml  = await fetchUrl(url);
                const data = parseSitemap(xml);

                if (data.isSitemapIndex) {
                    sitemaps.push({ url, type: 'index', childCount: data.sitemaps.length });
                    onProgress?.({ type: 'index', url, childCount: data.sitemaps.length });
                    for (const s of data.sitemaps) {
                        if (!visited.has(s.loc)) queue.push(s.loc);
                    }
                } else {
                    let added = 0;
                    for (const u of data.urls) {
                        if (!seenLocs.has(u.loc)) {
                            seenLocs.add(u.loc);
                            allUrls.push(u);
                            added++;
                        }
                    }
                    sitemaps.push({ url, type: 'urlset', urlCount: added });
                    onProgress?.({ type: 'urlset', url, urlCount: added, totalUrls: allUrls.length });
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
