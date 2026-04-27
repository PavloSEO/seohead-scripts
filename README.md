# SEO Scripts v2 — by seohead.tech

Настольное приложение на Electron для SEO-специалистов.

## Вкладки

| # | Вкладка | Цвет | Описание |
|---|---|---|---|
| 1 | **Redirect Builder** | 🔵 Синий | Генерация правил (Apache/Nginx/etc) + live-проверка цепочки редиректов |
| 2 | **Image Optimizer** | ⚪ Серый | Сжатие JPG/PNG/WebP/SVG с предпросмотром и бэкапом |
| 3 | **SEO Parser** | 🟢 Зелёный | Парсинг мета, OG, заголовков, JSON-LD, ссылок → MD |
| 4 | **Image Downloader** | 🟣 Фиолетовый | Скачивание изображений по списку URL с сохранением структуры |
| 5 | **Keyword Clusterer** | 🟠 Оранжевый | Кластеризация 10k+ ключей (Python + scikit-learn) |
| 6 | **Prompt Library** | 🔹 Бирюзовый | Библиотека SEO-промптов, фильтры, копирование и экспорт в MD |
| 7 | **Sitemap Analyser** | 🟢 Изумрудный | Обход sitemap index / urlset, дерево URL, экспорт MD и JSON |

Отдельный прототип в папке `sitemap-analyzer/` больше не ведётся: вся функциональность сайтмапов — во вкладке **Sitemap Analyser** (`src/main/sitemap.js`, `src/renderer/sitemap-app.js`).

## Установка

```bash
npm install
npm start
```

### Для Keyword Clusterer (Python необходим)

```bash
pip install scikit-learn numpy
# Опционально для стемминга:
pip install nltk
python3 -m nltk.downloader stopwords
```

## Сборка EXE

```bash
npm run build:installer
```

## Требования

- Node.js 18+
- Python 3.8+ (только для Keyword Clusterer)
