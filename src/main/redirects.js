// Логика генерации правил редиректов

/**
 * Нормализация URL - убирает домен, оставляет только путь
 * @param {string} url - URL для нормализации
 * @returns {string} - Нормализованный URL
 */
function normalizeUrl(url) {
    if (!url) return '';
    return url.trim().replace(/^https?:\/\/[^/]+/, '');
}

/**
 * Генерация одного правила редиректа
 * @param {string} oldUrl - Старый URL
 * @param {string} newUrl - Новый URL
 * @param {string} format - Формат правила
 * @param {string} customTemplate - Кастомный шаблон (если format === 'custom')
 * @returns {string} - Сгенерированное правило
 */
function generateRule(oldUrl, newUrl, format, customTemplate = '') {
    oldUrl = normalizeUrl(oldUrl);
    
    if (!oldUrl) {
        throw new Error('Старый URL не может быть пустым');
    }

    // Кастомный шаблон
    if (format === 'custom') {
        if (!customTemplate) {
            throw new Error('Кастомный шаблон не может быть пустым');
        }
        return customTemplate
            .replace(/{oldUrl}/g, oldUrl)
            .replace(/{newUrl}/g, newUrl || '');
    }

    // Apache форматы (mod_alias)
    if (format === 'apache-redirect-301') {
        if (!newUrl) {
            throw new Error('Новый URL обязателен для данного формата');
        }
        return `Redirect 301 ${oldUrl} ${newUrl}`;
    }
    
    if (format === 'apache-redirect-permanent') {
        if (!newUrl) {
            throw new Error('Новый URL обязателен для данного формата');
        }
        return `RedirectPermanent ${oldUrl} ${newUrl}`;
    }
    
    if (format === 'apache-redirectmatch-301') {
        if (!newUrl) {
            throw new Error('Новый URL обязателен для данного формата');
        }
        // RedirectMatch использует регулярные выражения, но для простоты используем точное совпадение
        // Для каталогов будет работать как RedirectMatch для всех подстраниц
        const escapedUrl = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Если URL заканчивается на /, добавляем (.*)$ для подстраниц
        if (oldUrl.endsWith('/')) {
            return `RedirectMatch 301 ^${escapedUrl}(.*)$ ${newUrl}$1`;
        }
        return `RedirectMatch 301 ^${escapedUrl}$ ${newUrl}`;
    }
    
    if (format === 'apache-redirect-410') {
        return `Redirect 410 ${oldUrl}`;
    }
    
    // Apache форматы (mod_rewrite)
    if (format === 'apache-rewrite-rule') {
        if (!newUrl) {
            throw new Error('Новый URL обязателен для данного формата');
        }
        return `RewriteRule ^${oldUrl.replace(/\$/g, '\\$')}$ ${newUrl} [R=301,L]`;
    }
    
    if (format === 'apache-rewrite-cond-rule') {
        if (!newUrl) {
            throw new Error('Новый URL обязателен для данного формата');
        }
        return `RewriteCond %{REQUEST_URI} ^${oldUrl.replace(/\$/g, '\\$')}/?$ [NC]\nRewriteRule ^ ${newUrl} [R=301,L]`;
    }
    
    if (format === 'apache-rewrite-cond-rule-ne') {
        if (!newUrl) {
            throw new Error('Новый URL обязателен для данного формата');
        }
        return `RewriteCond %{REQUEST_URI} ^${oldUrl.replace(/\$/g, '\\$')}/?$ [NC]\nRewriteRule ^ ${newUrl} [R=301,L,NE]`;
    }
    
    if (format === 'apache-rewrite-rule-gone') {
        return `RewriteRule ^${oldUrl.replace(/\$/g, '\\$')}$ - [G]`;
    }
    
    if (format === 'apache-rewrite-rule-with-qs') {
        if (!newUrl) {
            throw new Error('Новый URL обязателен для данного формата');
        }
        return `RewriteCond %{QUERY_STRING} ^(.*)$\nRewriteRule ^${oldUrl.replace(/\$/g, '\\$')}$ ${newUrl}?%1 [R=301,L]`;
    }

    // Nginx форматы
    if (format === 'nginx-return-301') {
        if (!newUrl) {
            throw new Error('Новый URL обязателен для данного формата');
        }
        return `return 301 ${newUrl};`;
    }
    
    if (format === 'nginx-rewrite') {
        if (!newUrl) {
            throw new Error('Новый URL обязателен для данного формата');
        }
        return `rewrite ^${oldUrl.replace(/\$/g, '\\$')}$ ${newUrl} permanent;`;
    }
    
    if (format === 'nginx-return-410') {
        return `return 410;`;
    }

    throw new Error(`Неизвестный формат: ${format}`);
}

/**
 * Генерация правил для массива редиректов
 * @param {Array} redirects - Массив объектов {oldUrl, newUrl, redirectToDefault}
 * @param {string} format - Формат правила
 * @param {string} defaultUrl - URL по умолчанию (если redirectToDefault === true)
 * @param {string} customTemplate - Кастомный шаблон
 * @returns {Array} - Массив сгенерированных правил
 */
function generateRules(redirects, format, defaultUrl = '/', customTemplate = '') {
    const rules = [];
    
    for (const redirect of redirects) {
        if (!redirect.oldUrl) continue;
        
        const newUrl = redirect.redirectToDefault ? defaultUrl : redirect.newUrl;
        
        try {
            const rule = generateRule(redirect.oldUrl, newUrl, format, customTemplate);
            rules.push({
                oldUrl: normalizeUrl(redirect.oldUrl),
                newUrl: newUrl || '',
                rule: rule
            });
        } catch (error) {
            rules.push({
                oldUrl: normalizeUrl(redirect.oldUrl),
                newUrl: newUrl || '',
                rule: `ОШИБКА: ${error.message}`,
                error: error.message
            });
        }
    }
    
    return rules;
}

module.exports = {
    generateRule,
    generateRules,
    normalizeUrl
};


// ── LIVE REDIRECT CHAIN CHECKER ──────────────────────────────────────────────

const https = require('https');
const http  = require('http');
const { URL } = require('url');

/**
 * Проверяет одну ступень редиректа — один HTTP запрос
 * @param {string} urlStr - URL для проверки
 * @returns {Promise<{url, status, location, contentType, ms}>}
 */
function checkStep(urlStr) {
    return new Promise((resolve) => {
        const start = Date.now();
        let parsed;
        try { parsed = new URL(urlStr); } catch {
            return resolve({ url: urlStr, status: 0, error: 'Неверный URL', ms: 0 });
        }

        const lib = parsed.protocol === 'https:' ? https : http;
        const opts = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SEO-Scripts/2.0; +https://seohead.tech)',
                'Accept': '*/*'
            },
            timeout: 10000
        };

        const req = lib.request(opts, (res) => {
            resolve({
                url: urlStr,
                status: res.statusCode,
                location: res.headers['location'] || null,
                contentType: res.headers['content-type'] || null,
                ms: Date.now() - start
            });
            res.resume();
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ url: urlStr, status: 0, error: 'Таймаут (10s)', ms: Date.now() - start });
        });
        req.on('error', (err) => {
            resolve({ url: urlStr, status: 0, error: err.message, ms: Date.now() - start });
        });
        req.end();
    });
}

/**
 * Проходит всю цепочку редиректов для одного URL
 * @param {string} startUrl - Начальный URL
 * @param {number} maxHops  - Максимум редиректов (защита от петель)
 * @returns {Promise<Array<step>>}
 */
async function checkChain(startUrl, maxHops = 15) {
    const chain = [];
    let current = startUrl.trim();
    const visited = new Set();

    while (current && chain.length < maxHops) {
        if (visited.has(current)) {
            chain.push({ url: current, status: 0, error: '🔁 Циклический редирект!', ms: 0 });
            break;
        }
        visited.add(current);

        const step = await checkStep(current);
        chain.push(step);

        // Если 3xx и есть Location — продолжаем
        if (step.status >= 300 && step.status < 400 && step.location) {
            // Разворачиваем относительные Location
            try {
                const resolved = new URL(step.location, current).href;
                current = resolved;
            } catch {
                break;
            }
        } else {
            break; // Конечный URL или ошибка
        }
    }

    return chain;
}

module.exports.checkChain = checkChain;
