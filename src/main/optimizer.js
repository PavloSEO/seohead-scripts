const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const klaw = require('klaw');
const { optimize: optimizeSvg } = require('svgo');

// Поддерживаемые форматы
const SHARP_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.gif'];
const ALL_FORMATS = [...SHARP_FORMATS, '.svg'];

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
}

function calculateQuality(level, userQuality) {
    if (userQuality > 0) return Math.min(100, Math.max(10, userQuality));
    const loss = 20 + level * 5;
    return Math.max(10, 100 - loss);
}

function getSharpConfig(ext, quality) {
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return { format: 'jpeg', options: { quality, mozjpeg: true } };
        case '.png':
            return { format: 'png', options: { compressionLevel: 9, quality } };
        case '.webp':
            return { format: 'webp', options: { quality, smartSubsample: true } };
        case '.tiff':
            return { format: 'tiff', options: { quality, compression: 'lzw' } };
        case '.gif':
            return { format: 'gif', options: { } };
        default:
            return null;
    }
}

// Транслитерация кириллицы
function transliterate(str) {
    const map = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
        и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
        с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh',
        щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
    };

    let result = '';
    for (const ch of str) {
        const lower = ch.toLowerCase();
        if (map[lower] !== undefined) {
            result += map[lower];
        } else {
            result += ch;
        }
    }
    return result;
}

function slugifyBaseName(baseName) {
    let s = transliterate(baseName.toLowerCase());
    s = s.replace(/[^a-z0-9]+/g, '-');
    s = s.replace(/^-+|-+$/g, '');
    if (!s) s = 'image';
    return s;
}

function getSlugPath(filePath) {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const base = path.basename(filePath, ext);
    const slugBase = slugifyBaseName(base);
    let targetPath = path.join(dir, slugBase + ext);

    if (targetPath === filePath) return null;

    let counter = 1;
    while (fs.existsSync(targetPath) && targetPath !== filePath) {
        targetPath = path.join(dir, `${slugBase}-${counter}${ext}`);
        counter++;
    }

    return targetPath;
}

// ==================== ОПТИМИЗАЦИЯ ====================

// Применить resize согласно настройкам
function applyResize(pipeline, metadata, settings) {
    if (settings.resizeMode === 'none') {
        // Старая логика - уменьшение при высоком уровне
        if (!settings.keepResolution && settings.level >= 6) {
            const factor = 1 - ((settings.level - 5) * 0.1);
            const newWidth = Math.round(metadata.width * factor);
            const newHeight = Math.round(metadata.height * factor);
            return pipeline.resize(newWidth, newHeight);
        }
        return pipeline;
    }
    
    if (settings.resizeMode === 'percent') {
        const factor = settings.resizePercent / 100;
        const newWidth = Math.round(metadata.width * factor);
        const newHeight = Math.round(metadata.height * factor);
        return pipeline.resize(newWidth, newHeight);
    }
    
    if (settings.resizeMode === 'maxSide') {
        const maxSize = settings.resizeMaxSide;
        if (metadata.width > maxSize || metadata.height > maxSize) {
            return pipeline.resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true });
        }
        return pipeline;
    }
    
    if (settings.resizeMode === 'exact') {
        const resizeOpts = {
            width: settings.resizeExactWidth,
            height: settings.resizeExactHeight
        };
        
        if (settings.resizeKeepAspect) {
            resizeOpts.fit = 'inside';
            resizeOpts.withoutEnlargement = false;
        } else {
            resizeOpts.fit = 'fill';
        }
        
        return pipeline.resize(resizeOpts);
    }
    
    return pipeline;
}

// Оптимизация через Sharp (JPEG, PNG, WebP, TIFF, GIF)
async function optimizeWithSharp(filePath, settings, tempPath) {
    const ext = path.extname(filePath).toLowerCase();
    const quality = calculateQuality(settings.level, settings.quality);
    
    // Специальная обработка для WebP: конвертировать через JPG
    if (ext === '.webp' && !settings.convertFormat) {
        return await optimizeWebPViaJpeg(filePath, settings, tempPath);
    }
    
    // Определить целевой формат
    let targetFormat = ext.replace('.', '');
    if (settings.convertFormat && settings.targetFormat) {
        targetFormat = settings.targetFormat;
    }
    
    const cfg = getSharpConfig('.' + targetFormat, quality);
    if (!cfg) return null;

    const image = sharp(filePath, { animated: ext === '.gif' }).rotate();
    const metadata = await image.metadata();
    
    let pipeline = image;

    // Применить resize
    pipeline = applyResize(pipeline, metadata, settings);

    // Удаление метаданных
    if (settings.removeMetadata) {
        pipeline = pipeline.withMetadata({ exif: undefined, icc: undefined });
    }

    await pipeline.toFormat(cfg.format, cfg.options).toFile(tempPath);
    
    return {
        width: metadata.width,
        height: metadata.height,
        format: cfg.format
    };
}

// Оптимизация WebP через конвертацию в JPG и обратно
async function optimizeWebPViaJpeg(filePath, settings, tempPath) {
    const quality = calculateQuality(settings.level, settings.quality);
    const tempJpg = tempPath + '.jpg';
    const tempWebP = tempPath + '.webp';
    
    try {
        const image = sharp(filePath).rotate();
        const metadata = await image.metadata();
        
        let pipeline = image;
        
        // Применить resize
        pipeline = applyResize(pipeline, metadata, settings);
        
        // Удаление метаданных
        if (settings.removeMetadata) {
            pipeline = pipeline.withMetadata({ exif: undefined, icc: undefined });
        }
        
        // Шаг 1: Конвертировать в JPG с высоким качеством сжатия
        await pipeline.clone().toFormat('jpeg', { quality, mozjpeg: true }).toFile(tempJpg);
        
        // Шаг 2: Конвертировать JPG обратно в WebP
        await sharp(tempJpg).toFormat('webp', { quality, smartSubsample: true }).toFile(tempWebP);
        
        // Сравнить размеры
        const jpgSize = fs.statSync(tempJpg).size;
        const webpSize = fs.statSync(tempWebP).size;
        
        // Выбрать лучший результат
        if (webpSize < jpgSize) {
            // WebP лучше - использовать его
            fs.renameSync(tempWebP, tempPath);
            fs.unlinkSync(tempJpg);
            return { width: metadata.width, height: metadata.height, format: 'webp' };
        } else {
            // JPG лучше - использовать его (меняем расширение)
            fs.renameSync(tempJpg, tempPath);
            fs.unlinkSync(tempWebP);
            return { width: metadata.width, height: metadata.height, format: 'jpeg', convertedFromWebP: true };
        }
    } catch (error) {
        // Очистка временных файлов
        if (fs.existsSync(tempJpg)) fs.unlinkSync(tempJpg);
        if (fs.existsSync(tempWebP)) fs.unlinkSync(tempWebP);
        throw error;
    }
}

// Оптимизация SVG через SVGO
async function optimizeSvgFile(filePath, tempPath) {
    const svgContent = fs.readFileSync(filePath, 'utf8');
    
    const result = optimizeSvg(svgContent, {
        multipass: true,
        plugins: [
            'preset-default',
            { name: 'removeViewBox', active: false },
            { name: 'removeDimensions', active: false }
        ]
    });

    fs.writeFileSync(tempPath, result.data, 'utf8');
    return { format: 'svg' };
}

// Главная функция оптимизации одного файла
async function optimizeFile(filePath, settings, backupDir) {
    // #region agent log
    const logPath = path.join(__dirname, '../../.cursor/debug.log');
    try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:155',message:'optimizeFile called',data:{filePath:filePath.split(/[\\/]/).pop(),fileExists:fs.existsSync(filePath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n'); } catch(e) {}
    // #endregion
    const ext = path.extname(filePath).toLowerCase();
    
    if (!ALL_FORMATS.includes(ext)) {
        return { skipped: true, reason: 'unsupported' };
    }

    let originalSize;
    try {
        originalSize = fs.statSync(filePath).size;
    } catch (e) {
        // #region agent log
        try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:165',message:'file stat error',data:{filePath:filePath.split(/[\\/]/).pop(),error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n'); } catch(ee) {}
        // #endregion
        return { success: false, error: `File not found: ${e.message}`, path: filePath };
    }
    const tempPath = filePath + '.tmp';

    let backupPath = null;
    try {
        // Бэкап
        if (settings.createBackup && backupDir) {
            backupPath = path.join(backupDir, path.basename(filePath));
            fs.mkdirSync(path.dirname(backupPath), { recursive: true });
            fs.copyFileSync(filePath, backupPath);
        }

        // Выбор оптимизатора
        let meta;
        if (SHARP_FORMATS.includes(ext)) {
            meta = await optimizeWithSharp(filePath, settings, tempPath);
        } else if (ext === '.svg') {
            meta = await optimizeSvgFile(filePath, tempPath);
        }

        if (!meta) {
            return { skipped: true, reason: 'no-optimizer' };
        }

        // Определяем целевое расширение (может отличаться от исходного при конвертации)
        // Примеры: photo.jpg -> webp; photo.webp -> jpg (если JPG оказался меньше)
        const formatToExt = (fmt) => {
            if (!fmt) return ext;
            const f = fmt.toLowerCase();
            if (f === 'jpeg') return '.jpg';
            return '.' + f;
        };
        const targetExt = formatToExt(meta.format);
        
        let workingPath = filePath; // путь, с которым работаем дальше
        const oldName = path.basename(filePath);
        
        if (targetExt !== ext) {
            // Формат изменился - нужно записать в файл с новым расширением
            const dir = path.dirname(filePath);
            const baseNoExt = path.basename(filePath, ext);
            let convertedPath = path.join(dir, baseNoExt + targetExt);
            
            // Если такой файл уже существует - добавляем суффикс
            let counter = 1;
            while (fs.existsSync(convertedPath) && convertedPath !== filePath) {
                convertedPath = path.join(dir, `${baseNoExt}-${counter}${targetExt}`);
                counter++;
            }
            
            // Переносим результат в файл с новым расширением
            fs.renameSync(tempPath, convertedPath);
            
            // Удаляем исходный файл (у него теперь другое расширение, не перетрёрся)
            if (fs.existsSync(filePath) && filePath !== convertedPath) {
                try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
            }
            
            workingPath = convertedPath;
        } else {
            // Формат не менялся - обычный replace
            fs.renameSync(tempPath, filePath);
        }

        const newSize = fs.statSync(workingPath).size;
        const saved = originalSize - newSize;
        const percent = originalSize > 0 ? ((saved / originalSize) * 100) : 0;

        // ЧПУ переименование (работаем с workingPath, который мог измениться при конвертации)
        let newPath = workingPath;
        let renamed = workingPath !== filePath; // уже переименован при конвертации формата
        if (settings.useSlug) {
            const slugPath = getSlugPath(workingPath);
            // #region agent log
            const logPath = path.join(__dirname, '../../.cursor/debug.log');
            try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:206',message:'before rename check',data:{originalPath:filePath.split(/[\\/]/).pop(),slugPath:slugPath?.split(/[\\/]/).pop(),originalExists:fs.existsSync(filePath),useSlug:settings.useSlug},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n'); } catch(e) {}
            // #endregion
            if (slugPath) {
                try {
                    fs.renameSync(workingPath, slugPath);
                    newPath = slugPath;
                    renamed = true;
                    // #region agent log
                    try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:212',message:'file renamed',data:{originalPath:workingPath.split(/[\\/]/).pop(),newPath:slugPath.split(/[\\/]/).pop(),newExists:fs.existsSync(slugPath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n'); } catch(ee) {}
                    // #endregion
                } catch (e) {
                    // #region agent log
                    try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:216',message:'rename error',data:{originalPath:workingPath.split(/[\\/]/).pop(),slugPath:slugPath?.split(/[\\/]/).pop(),error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n'); } catch(ee) {}
                    // #endregion
                }
            }
        }

        return {
            success: true,
            originalSize,
            newSize,
            saved,
            percent: percent.toFixed(1),
            path: newPath,
            renamed,
            oldName: oldName,
            newName: path.basename(newPath),
            backupPath: backupPath
        };

    } catch (error) {
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
        return {
            success: false,
            error: error.message,
            path: filePath
        };
    }
}

// ==================== СБОР ФАЙЛОВ ====================

function collectFilesFromFolder(folderPath) {
    return new Promise((resolve, reject) => {
        const files = [];
        
        klaw(folderPath)
            .on('data', (item) => {
                if (!item.stats.isFile()) return;
                const ext = path.extname(item.path).toLowerCase();
                if (ALL_FORMATS.includes(ext)) {
                    files.push(item.path);
                }
            })
            .on('error', reject)
            .on('end', () => resolve(files));
    });
}

async function collectAllFiles(paths) {
    const allFiles = [];
    
    for (const p of paths) {
        try {
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
                const files = await collectFilesFromFolder(p);
                allFiles.push(...files);
            } else if (stat.isFile()) {
                const ext = path.extname(p).toLowerCase();
                if (ALL_FORMATS.includes(ext)) {
                    allFiles.push(p);
                }
            }
        } catch (e) {
            // Skip invalid paths
        }
    }
    
    return allFiles;
}

// ==================== ОБРАБОТКА ====================

async function processFiles(paths, settings, onProgress) {
    // #region agent log
    const logPath = path.join(__dirname, '../../.cursor/debug.log');
    try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:268',message:'processFiles called',data:{pathsCount:paths.length,paths:paths.slice(0,3).map(p=>p.split(/[\\/]/).pop()),settings},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n'); } catch(e) {}
    // #endregion
    const files = await collectAllFiles(paths);
    // #region agent log
    try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:271',message:'collectAllFiles result',data:{filesFound:files.length,fileNames:files.slice(0,5).map(f=>f.split(/[\\/]/).pop())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n'); } catch(e) {}
    // #endregion
    const total = files.length;
    
    if (total === 0) {
        return {
            total: 0,
            processed: 0,
            totalOriginal: 0,
            totalOptimized: 0,
            saved: 0,
            errors: [],
            results: []
        };
    }

    const results = [];
    const errors = [];
    let totalOriginal = 0;
    let totalOptimized = 0;
    let processed = 0;

    // Папка бэкапов
    let backupDir = null;
    if (settings.createBackup) {
        if (settings.backupFolder) {
            backupDir = settings.backupFolder;
        } else if (paths.length === 1 && fs.statSync(paths[0]).isDirectory()) {
            backupDir = path.join(paths[0], '..', 'backup');
        } else {
            backupDir = path.join(path.dirname(files[0]), 'backup');
        }
        fs.mkdirSync(backupDir, { recursive: true });
    }

    for (const filePath of files) {
        // #region agent log
        try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:301',message:'processing file start',data:{fileIndex:processed+1,total:total,filePath:filePath.split(/[\\/]/).pop(),fileExists:fs.existsSync(filePath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n'); } catch(e) {}
        // #endregion
        onProgress({
            current: processed + 1,
            total,
            percent: ((processed / total) * 100).toFixed(0),
            currentFile: path.basename(filePath),
            status: 'processing'
        });

        const result = await optimizeFile(filePath, settings, backupDir);
        // #region agent log
        try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:311',message:'optimizeFile result',data:{success:result.success,originalPath:filePath.split(/[\\/]/).pop(),newPath:result.path?.split(/[\\/]/).pop(),renamed:result.renamed,error:result.error,percent:result.percent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n'); } catch(e) {}
        // #endregion
        
        if (result.success) {
            totalOriginal += result.originalSize;
            totalOptimized += result.newSize;
            results.push(result);
        } else if (result.error) {
            errors.push({ file: filePath, error: result.error });
        }

        processed++;

        onProgress({
            current: processed,
            total,
            percent: ((processed / total) * 100).toFixed(0),
            currentFile: path.basename(filePath),
            status: processed === total ? 'complete' : 'processing',
            lastResult: result
        });
    }

    const totalSaved = totalOriginal - totalOptimized;
    const savedPercent = totalOriginal > 0 
        ? ((totalSaved / totalOriginal) * 100).toFixed(1) 
        : 0;

    return {
        total,
        processed,
        totalOriginal,
        totalOptimized,
        saved: totalSaved,
        savedPercent,
        totalOriginalFormatted: formatSize(totalOriginal),
        totalOptimizedFormatted: formatSize(totalOptimized),
        savedFormatted: formatSize(totalSaved),
        errors,
        results,
        backupDir
    };
}

// ==================== ПРЕВЬЮ ====================

async function getImagePreview(filePath) {
    // #region agent log
    const logPath = path.join(__dirname, '../../.cursor/debug.log');
    try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:353',message:'getImagePreview called',data:{filePath:filePath.split(/[\\/]/).pop(),fileExists:fs.existsSync(filePath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n'); } catch(e) {}
    // #endregion
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.svg') {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const base64 = Buffer.from(content).toString('base64');
            return {
                dataUrl: `data:image/svg+xml;base64,${base64}`,
                width: null,
                height: null,
                format: 'svg'
            };
        } catch (e) {
            // #region agent log
            try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:361',message:'svg read error',data:{filePath:filePath.split(/[\\/]/).pop(),error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n'); } catch(ee) {}
            // #endregion
            throw e;
        }
    }

    let metadata;
    try {
        metadata = await sharp(filePath).metadata();
    } catch (e) {
        // #region agent log
        try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:370',message:'sharp metadata error',data:{filePath:filePath.split(/[\\/]/).pop(),error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n'); } catch(ee) {}
        // #endregion
        throw e;
    }
    
    const previewBuffer = await sharp(filePath)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .toFormat('jpeg', { quality: 80 })
        .toBuffer();
    
    const base64 = previewBuffer.toString('base64');
    
    return {
        dataUrl: `data:image/jpeg;base64,${base64}`,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
    };
}

async function getFileInfo(filePath) {
    // #region agent log
    const logPath = path.join(__dirname, '../../.cursor/debug.log');
    try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:387',message:'getFileInfo called',data:{filePath:filePath.split(/[\\/]/).pop(),fileExists:fs.existsSync(filePath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n'); } catch(e) {}
    // #endregion
    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch (e) {
        // #region agent log
        try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:391',message:'getFileInfo stat error',data:{filePath:filePath.split(/[\\/]/).pop(),error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n'); } catch(ee) {}
        // #endregion
        throw e;
    }
    const ext = path.extname(filePath).toLowerCase();
    
    let width = null;
    let height = null;
    let format = ext.replace('.', '').toUpperCase();
    
    if (SHARP_FORMATS.includes(ext)) {
        try {
            const metadata = await sharp(filePath).metadata();
            width = metadata.width;
            height = metadata.height;
            format = metadata.format ? metadata.format.toUpperCase() : format;
        } catch (e) {
            // #region agent log
            try { fs.appendFileSync(logPath, JSON.stringify({location:'optimizer.js:405',message:'getFileInfo sharp error',data:{filePath:filePath.split(/[\\/]/).pop(),error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n'); } catch(ee) {}
            // #endregion
        }
    }
    
    return {
        name: path.basename(filePath),
        path: filePath,
        size: stat.size,
        sizeFormatted: formatSize(stat.size),
        width,
        height,
        format,
        modified: stat.mtime
    };
}

module.exports = {
    processFiles,
    getImagePreview,
    getFileInfo,
    collectAllFiles,
    ALL_FORMATS,
    formatSize
};
