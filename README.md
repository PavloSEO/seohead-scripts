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
