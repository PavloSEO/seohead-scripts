// ── IMAGE DOWNLOADER ─────────────────────────────────────────────────────────
const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { URL } = require('url');

function getLocalPath(urlStr, outputDir, structure) {
    try {
        const u = new URL(urlStr);
        if (structure === 'flat') {
            const filename = path.basename(u.pathname) || 'image';
            return path.join(outputDir, filename);
        }
        // domain/path/file
        const parts = [outputDir, u.hostname, ...u.pathname.split('/').filter(Boolean)];
        return path.join(...parts);
    } catch {
        return path.join(outputDir, 'image_' + Date.now());
    }
}

function downloadFile(urlStr, destPath) {
    return new Promise((resolve, reject) => {
        let parsed;
        try { parsed = new URL(urlStr); } catch(e) { return reject(e); }

        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.get({
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': parsed.origin
            },
            timeout: 30000
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return downloadFile(new URL(res.headers.location, urlStr).href, destPath)
                    .then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            const file = fs.createWriteStream(destPath);
            res.pipe(file);
            file.on('finish', () => {
                const size = fs.statSync(destPath).size;
                resolve({ destPath, size });
            });
            file.on('error', reject);
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.on('error', reject);
    });
}

/**
 * Скачивает список URL изображений с прогрессом
 * @param {string[]} urls
 * @param {string} outputDir
 * @param {Object} options - { structure, concurrency, skipExisting }
 * @param {Function} onProgress - (item) callback
 */
async function downloadImages(urls, outputDir, options, onProgress) {
    const { structure = 'domain-path', concurrency = 3, skipExisting = true } = options;
    const results = [];

    // Разбиваем на батчи по concurrency
    for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency);
        const promises = batch.map(async (urlStr) => {
            const destPath = getLocalPath(urlStr, outputDir, structure);
            
            if (skipExisting && fs.existsSync(destPath)) {
                const item = { url: urlStr, status: 'skipped', destPath, size: fs.statSync(destPath).size };
                onProgress && onProgress(item);
                return item;
            }

            try {
                const { size } = await downloadFile(urlStr, destPath);
                const item = { url: urlStr, status: 'done', destPath, size };
                onProgress && onProgress(item);
                return item;
            } catch(e) {
                const item = { url: urlStr, status: 'error', error: e.message };
                onProgress && onProgress(item);
                return item;
            }
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
    }

    return results;
}

module.exports = { downloadImages };
