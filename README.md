# SEO Scripts — seohead.tech

Десктопное приложение на Electron для SEO-специалистов. 7 инструментов в одном окне, тёмная тема Material Design 3, работает на Windows без интернета.

## Инструменты

| # | Вкладка | Что делает |
|---|---|---|
| 1 | **Redirect Builder** | Генерирует правила редиректов Apache / Nginx / кастомный шаблон. Импорт из Excel, массовая вставка, live-проверка цепочки редиректов. |
| 2 | **Image Optimizer** | Сжимает JPG, PNG, WebP, GIF, SVG, TIFF через Sharp. Пресеты, ресайз, конвертация форматов, бэкапы, сравнение до/после. |
| 3 | **SEO Parser** | Парсит Title, Description, OG, H1–H6, JSON-LD, ссылки, текст. Режимы HTTP и JS-рендеринг (Chromium). Экспорт в Markdown. |
| 4 | **Image Downloader** | Скачивает изображения по списку URL, сохраняет структуру папок или плоско, конвертирует в WebP, докачка без повторов. |
| 5 | **Keyword Clusterer** | Кластеризует 50 000+ ключевых слов: K-Means, DBSCAN, Agglomerative. Требует Python 3 + scikit-learn. Экспорт CSV / XLSX. |
| 6 | **Prompt Library** | Библиотека SEO-промптов с фильтрами по модели (ChatGPT / Claude / Gemini), тегам, категориям. Подстановка переменных, экспорт MD. |
| 7 | **Sitemap Analyser** | Рекурсивный обход sitemap index / urlset, поддержка gzip. Дерево URL, mindmap-карта на canvas, экспорт MD / JSON / PNG. |

## Быстрый старт

```bash
npm install
npm start
```

## Keyword Clusterer — Python

```bash
pip install scikit-learn numpy nltk
python3 -m nltk.downloader stopwords
```

## Сборка EXE

```bash
# Папка dist/ без установщика
npm run build:unpacked

# NSIS-установщик
npm run build:installer
```

## Требования

- Node.js 18+
- Electron 28
- Python 3.8+ — только для Keyword Clusterer
