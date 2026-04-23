// ── SEO PARSER ───────────────────────────────────────────────────────────────
// Режим HTTP: axios + node-html-parser (встроен)
// Режим JS:   скрытый BrowserWindow Electron (без Puppeteer!)
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https');
const http  = require('http');
const { URL } = require('url');
const fs    = require('fs');
const path  = require('path');

// ── USER AGENTS ──────────────────────────────────────────────────────────────
const UA_MAP = {
    googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    chrome:    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    firefox:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    mobile:    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
};

// ── HTTP FETCH ───────────────────────────────────────────────────────────────
function httpFetch(urlStr, ua, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        let parsed;
        try { parsed = new URL(urlStr); } catch(e) { return reject(e); }

        const lib = parsed.protocol === 'https:' ? https : http;
        const opts = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers: {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,*/*',
                'Accept-Language': 'ru,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Cache-Control': 'no-cache',
            },
            timeout: timeoutMs
        };

        const req = lib.request(opts, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                const redirectUrl = new URL(res.headers.location, urlStr).href;
                return httpFetch(redirectUrl, ua, timeoutMs).then(resolve).catch(reject);
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({
                status: res.statusCode,
                html: Buffer.concat(chunks).toString('utf8'),
                finalUrl: urlStr
            }));
        });

        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.on('error', reject);
        req.end();
    });
}

// ── HTML PARSER (без зависимостей — regex-based) ──────────────────────────────
function parseHtml(html, urlStr, opts) {
    const result = { url: urlStr };

    const $ = (pattern) => {
        const m = html.match(pattern);
        return m ? (m[1] || '').trim() : null;
    };
    const $all = (pattern) => {
        const matches = [];
        let m;
        const re = new RegExp(pattern.source, 'gi');
        while ((m = re.exec(html)) !== null) matches.push(m[1] ? m[1].trim() : m[0]);
        return matches;
    };

    // Title
    if (opts.meta) {
        result.title       = $(/(<title[^>]*>)([\s\S]*?)<\/title>/i)?.replace(/<[^>]+>/g,'').trim()
                          || $(/(<title[^>]*>)([\s\S]*?)<\/title>/i);
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        result.title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g,'').trim() : null;

        result.description = $(/meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)
                          || $(/meta[^>]+content=["']([^"']*?)["'][^>]+name=["']description["']/i);

        result.lang = $(/html[^>]+lang=["']([^"']*)/i);

        result.robots    = $(/meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i)
                        || $(/meta[^>]+content=["']([^"']*?)["'][^>]+name=["']robots["']/i);
        result.canonical = $(/link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i)
                        || $(/link[^>]+href=["']([^"']*?)["'][^>]+rel=["']canonical["']/i);
    }

    // OG Tags
    if (opts.og) {
        result.og = {};
        const ogPattern = /meta[^>]+property=["'](og:[^"']+)["'][^>]+content=["']([^"']*)/gi;
        let m;
        while ((m = ogPattern.exec(html)) !== null) result.og[m[1]] = m[2].trim();
        const twPattern = /meta[^>]+name=["'](twitter:[^"']+)["'][^>]+content=["']([^"']*)/gi;
        while ((m = twPattern.exec(html)) !== null) result.og[m[1]] = m[2].trim();
    }

    // Headings
    if (opts.headings) {
        result.headings = {};
        for (let i = 1; i <= 6; i++) {
            const re = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\/h${i}>`, 'gi');
            const found = [];
            let hm;
            while ((hm = re.exec(html)) !== null) {
                const text = hm[1].replace(/<[^>]+>/g, '').trim();
                if (text) found.push(text);
            }
            if (found.length) result.headings[`h${i}`] = found;
        }
    }

    // JSON-LD
    if (opts.jsonld) {
        const schemas = [];
        const ldPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let ldm;
        while ((ldm = ldPattern.exec(html)) !== null) {
            try { schemas.push(JSON.parse(ldm[1].trim())); } catch {}
        }
        result.jsonld = schemas;
    }

    // Links
    if (opts.links) {
        const base = new URL(urlStr).origin;
        const internal = new Set(), external = new Set();
        const linkPattern = /href=["']([^"'#?][^"']*)/gi;
        let lm;
        while ((lm = linkPattern.exec(html)) !== null) {
            const href = lm[1].trim();
            if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
            try {
                const abs = new URL(href, urlStr).href;
                abs.startsWith(base) ? internal.add(abs) : external.add(abs);
            } catch {}
        }
        result.links = {
            internal: [...internal].slice(0, 100),
            external: [...external].slice(0, 100)
        };
    }

    // Images
    if (opts.images) {
        const imgs = [];
        const imgPattern = /<img[^>]+>/gi;
        let im;
        while ((im = imgPattern.exec(html)) !== null) {
            const src = im[0].match(/src=["']([^"']+)/i)?.[1];
            const alt = im[0].match(/alt=["']([^"']*)/i)?.[1] || '';
            if (src) imgs.push({ src, alt });
        }
        result.images = imgs.slice(0, 50);
    }

    // Text content
    if (opts.text) {
        let text = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
        result.text = text.substring(0, 15000); // первые ~15k символов
    }

    return result;
}

// ── MARKDOWN GENERATOR ────────────────────────────────────────────────────────
function toMarkdown(data) {
    const lines = [];
    const add = (s) => lines.push(s);
    const hr = () => add('---');

    add(`# SEO Отчёт: ${data.url}`);
    add(`> Дата: ${new Date().toLocaleString('ru-RU')}`);
    add('');

    // Meta
    if (data.title !== undefined) {
        add('## 📋 Мета-данные');
        add(`| Поле | Значение |`);
        add(`|---|---|`);
        add(`| Title | ${data.title || '—'} |`);
        add(`| Description | ${data.description || '—'} |`);
        add(`| Canonical | ${data.canonical || '—'} |`);
        add(`| Robots | ${data.robots || '—'} |`);
        add(`| Lang | ${data.lang || '—'} |`);
        add('');
    }

    // OG
    if (data.og && Object.keys(data.og).length) {
        add('## 🔗 Open Graph / Twitter Cards');
        add(`| Тег | Значение |`);
        add(`|---|---|`);
        for (const [k, v] of Object.entries(data.og)) add(`| ${k} | ${v} |`);
        add('');
    }

    // Headings
    if (data.headings) {
        add('## 📑 Структура заголовков');
        for (let i = 1; i <= 6; i++) {
            const list = data.headings[`h${i}`];
            if (list?.length) {
                add(`**H${i}** (${list.length})`);
                list.slice(0, 20).forEach(h => add(`- ${h}`));
            }
        }
        add('');
    }

    // JSON-LD
    if (data.jsonld?.length) {
        add('## 🏷️ Структурированные данные (JSON-LD)');
        data.jsonld.forEach((schema, i) => {
            add(`**Схема ${i+1}:** \`${schema['@type'] || '?'}\``);
            add('```json');
            add(JSON.stringify(schema, null, 2).substring(0, 2000));
            add('```');
        });
        add('');
    }

    // Links
    if (data.links) {
        add('## 🔍 Ссылки');
        add(`- Внутренних: **${data.links.internal.length}**`);
        add(`- Внешних: **${data.links.external.length}**`);
        if (data.links.internal.length) {
            add('');
            add('**Внутренние:**');
            data.links.internal.slice(0, 30).forEach(l => add(`- ${l}`));
        }
        if (data.links.external.length) {
            add('');
            add('**Внешние:**');
            data.links.external.slice(0, 30).forEach(l => add(`- ${l}`));
        }
        add('');
    }

    // Images
    if (data.images?.length) {
        add('## 🖼️ Изображения');
        add(`| src | alt |`);
        add(`|---|---|`);
        data.images.slice(0, 30).forEach(img => add(`| ${img.src} | ${img.alt || '—'} |`));
        add('');
    }

    // Text
    if (data.text) {
        add('## 📝 Текст страницы');
        add(data.text);
        add('');
    }

    return lines.join('\n');
}

// ── PARSE ONE URL (HTTP mode) ─────────────────────────────────────────────────
async function parseUrl(urlStr, options) {
    const ua = options.customUa || UA_MAP[options.ua] || UA_MAP.chrome;
    try {
        const { status, html, finalUrl } = await httpFetch(urlStr, ua);
        const data   = parseHtml(html, finalUrl, options);
        data.status  = status;
        data.md      = toMarkdown(data);
        return { success: true, data };
    } catch(e) {
        return { success: false, url: urlStr, error: e.message };
    }
}

module.exports = { parseUrl, toMarkdown };
