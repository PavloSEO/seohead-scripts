#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SEO Keyword Clusterer
Стек: scikit-learn TF-IDF + K-Means / DBSCAN / Agglomerative
Поддерживает 10k–100k+ ключей
Автор: seohead.tech
"""

import sys
import json
import os
import math
import csv
import io

# Проверка зависимостей
try:
    import sklearn
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
    from sklearn.preprocessing import normalize
    from sklearn.metrics import silhouette_score
    import numpy as np
except ImportError as e:
    print(json.dumps({"error": f"Не установлена библиотека: {e}. Запустите: pip install scikit-learn numpy"}))
    sys.exit(1)

# Опциональный стемминг
try:
    from nltk.stem.snowball import SnowballStemmer
    from nltk.corpus import stopwords
    import nltk
    NLTK_OK = True
except ImportError:
    NLTK_OK = False


def log(msg, level="info"):
    """Отправка лога в stdout для Electron"""
    print(json.dumps({"log": msg, "level": level}), flush=True)


def load_keywords(filepath):
    """Загрузка ключей из CSV или TXT"""
    keywords = []
    ext = os.path.splitext(filepath)[1].lower()

    with open(filepath, 'r', encoding='utf-8-sig') as f:
        if ext in ('.csv',):
            reader = csv.reader(f)
            for row in reader:
                if row and row[0].strip():
                    keywords.append(row[0].strip())
        else:  # TXT или любой другой
            for line in f:
                kw = line.strip()
                if kw:
                    keywords.append(kw)

    return keywords


def preprocess(keywords, language='russian', do_stem=True, do_stopwords=True):
    """Предобработка: нижний регистр + стемминг + стоп-слова"""
    processed = [kw.lower() for kw in keywords]

    if do_stem and NLTK_OK:
        lang_map = {'russian': 'russian', 'english': 'english', 'auto': 'russian'}
        stem_lang = lang_map.get(language, 'russian')
        try:
            stemmer = SnowballStemmer(stem_lang)
            processed = [' '.join(stemmer.stem(w) for w in kw.split()) for kw in processed]
        except Exception as e:
            log(f"Стемминг пропущен: {e}", "warn")

    return processed


def get_stop_words(language):
    """Получить стоп-слова"""
    if NLTK_OK:
        try:
            lang_map = {'russian': 'russian', 'english': 'english', 'auto': 'russian'}
            nltk_lang = lang_map.get(language, 'russian')
            try:
                return list(stopwords.words(nltk_lang))
            except LookupError:
                nltk.download('stopwords', quiet=True)
                return list(stopwords.words(nltk_lang))
        except Exception:
            pass

    # Базовые стоп-слова если NLTK нет
    ru_stops = ['и','в','не','на','с','по','для','это','а','что','как','то','все','он','она','они','мы','вы','я','к','из','за']
    en_stops = ['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were']
    if language == 'english':
        return en_stops
    return ru_stops


def elbow_k(X, max_k=50):
    """Метод локтя для определения оптимального K"""
    inertias = []
    k_range = range(2, min(max_k + 1, X.shape[0] // 2))
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=5, max_iter=100)
        km.fit(X)
        inertias.append(km.inertia_)

    # Поиск "локтя" через максимальное изменение второй производной
    if len(inertias) < 3:
        return 2
    diffs = [inertias[i] - inertias[i+1] for i in range(len(inertias)-1)]
    diffs2 = [diffs[i] - diffs[i+1] for i in range(len(diffs)-1)]
    elbow_idx = diffs2.index(max(diffs2)) + 2
    return list(k_range)[elbow_idx]


def cluster_name(keywords_in_cluster):
    """Автоматическое название кластера — самое частое слово"""
    freq = {}
    for kw in keywords_in_cluster:
        for word in kw.lower().split():
            if len(word) > 3:
                freq[word] = freq.get(word, 0) + 1
    if not freq:
        return 'Кластер'
    return max(freq, key=freq.get)


def main():
    # Читаем параметры из stdin (JSON)
    try:
        params = json.loads(sys.stdin.read())
    except Exception as e:
        print(json.dumps({"error": f"Ошибка чтения параметров: {e}"}))
        sys.exit(1)

    filepath    = params.get('filepath', '')
    method      = params.get('method', 'kmeans')
    k           = int(params.get('k', 20))
    auto_k      = params.get('auto_k', False)
    language    = params.get('language', 'russian')
    do_stem     = params.get('stem', True)
    do_stopwords= params.get('stopwords', True)
    max_features= int(params.get('max_features', 10000))

    # Загрузка
    log(f"Загрузка файла: {filepath}")
    try:
        keywords = load_keywords(filepath)
    except Exception as e:
        print(json.dumps({"error": f"Ошибка загрузки файла: {e}"}))
        sys.exit(1)

    if not keywords:
        print(json.dumps({"error": "Файл пуст или не содержит ключей"}))
        sys.exit(1)

    log(f"Загружено {len(keywords)} ключей")

    # Предобработка
    log("Предобработка текста...")
    processed = preprocess(keywords, language, do_stem, do_stopwords)
    stop_words = get_stop_words(language) if do_stopwords else None

    # TF-IDF векторизация
    log(f"TF-IDF векторизация (max_features={max_features})...")
    vectorizer = TfidfVectorizer(
        max_features=max_features,
        ngram_range=(1, 2),
        stop_words=stop_words,
        sublinear_tf=True
    )
    try:
        X = vectorizer.fit_transform(processed)
    except Exception as e:
        print(json.dumps({"error": f"Ошибка векторизации: {e}"}))
        sys.exit(1)

    log(f"Матрица: {X.shape[0]} ключей × {X.shape[1]} признаков")

    # Кластеризация
    labels = None

    if method == 'kmeans':
        if auto_k:
            log("Поиск оптимального K (метод локтя)...")
            k = elbow_k(normalize(X), max_k=min(100, len(keywords)//5))
            log(f"Оптимальный K = {k}")
        else:
            k = min(k, len(keywords) - 1)
        log(f"K-Means, k={k}...")
        km = KMeans(n_clusters=k, random_state=42, n_init=10, max_iter=300)
        labels = km.fit_predict(X)

    elif method == 'dbscan':
        log("DBSCAN кластеризация...")
        Xn = normalize(X)
        db = DBSCAN(eps=0.3, min_samples=2, metric='cosine', algorithm='brute', n_jobs=-1)
        labels = db.fit_predict(Xn)

    elif method == 'agglomerative':
        k = min(k, len(keywords) - 1)
        log(f"Agglomerative Clustering, k={k}...")
        # Для больших датасетов - ограничение
        if X.shape[0] > 10000:
            log("Большой датасет — используем K-Means вместо Agglomerative", "warn")
            km = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = km.fit_predict(X)
        else:
            Xn = normalize(X).toarray()
            ag = AgglomerativeClustering(n_clusters=k, metric='cosine', linkage='average')
            labels = ag.fit_predict(Xn)

    if labels is None:
        print(json.dumps({"error": "Кластеризация не выполнена"}))
        sys.exit(1)

    # Группировка результатов
    log("Группировка и именование кластеров...")
    clusters = {}
    for idx, label in enumerate(labels):
        cl = int(label)
        if cl not in clusters:
            clusters[cl] = []
        clusters[cl].append(keywords[idx])

    # Сортировка по размеру (от большего к меньшему)
    sorted_clusters = sorted(clusters.items(), key=lambda x: -len(x[1]))

    # Переименовываем кластеры: -1 (DBSCAN шум) → "Без кластера"
    output_clusters = []
    for i, (label, kws) in enumerate(sorted_clusters):
        name = 'Без кластера' if label == -1 else cluster_name(kws)
        output_clusters.append({
            'id': i + 1,
            'name': name,
            'count': len(kws),
            'keywords': kws
        })

    result = {
        'success': True,
        'total_keywords': len(keywords),
        'total_clusters': len(output_clusters),
        'method': method,
        'clusters': output_clusters
    }

    log(f"Готово! {len(keywords)} ключей → {len(output_clusters)} кластеров")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
