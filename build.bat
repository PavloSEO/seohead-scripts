@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title SEO Scripts — Builder

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║          SEO Scripts v2 — Build Script              ║
echo ║                  seohead.tech                       ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: ── Параметры ────────────────────────────────────────────────────────────────
set PYTHON_CMD=python
set BUILD_DIR=%~dp0dist
set RESOURCES_DIR=%~dp0build-resources

:: Проверяем python
echo [1/5] Проверка Python...
%PYTHON_CMD% --version >nul 2>&1
if %errorlevel% neq 0 (
    set PYTHON_CMD=python3
    python3 --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo [WARN] Python не найден — кластеризатор не будет включён в сборку.
        echo        Установите Python 3.8+ и запустите build.bat снова.
        set SKIP_PYTHON=1
    )
)
if not defined SKIP_PYTHON (
    for /f "tokens=*" %%v in ('%PYTHON_CMD% --version 2^>^&1') do echo        %%v найден
)
echo.

:: ── Зависимости Python ───────────────────────────────────────────────────────
if not defined SKIP_PYTHON (
    echo [2/5] Установка Python зависимостей...
    %PYTHON_CMD% -m pip install --quiet --upgrade scikit-learn numpy pyinstaller
    if %errorlevel% neq 0 (
        echo [ERROR] Не удалось установить Python зависимости.
        echo         Запустите вручную: pip install scikit-learn numpy pyinstaller
        pause
        exit /b 1
    )
    echo        scikit-learn, numpy, pyinstaller — OK
    echo.

    :: ── Сборка clusterer.exe ─────────────────────────────────────────────────
    echo [3/5] Сборка clusterer.exe (PyInstaller)...
    if not exist "%RESOURCES_DIR%" mkdir "%RESOURCES_DIR%"

    %PYTHON_CMD% -m PyInstaller ^
        --onefile ^
        --name clusterer ^
        --distpath "%RESOURCES_DIR%" ^
        --workpath "%TEMP%\pyinstaller-work" ^
        --specpath "%TEMP%\pyinstaller-spec" ^
        --clean ^
        --noconfirm ^
        --hidden-import sklearn ^
        --hidden-import sklearn.feature_extraction.text ^
        --hidden-import sklearn.cluster ^
        --hidden-import sklearn.preprocessing ^
        --hidden-import numpy ^
        src\main\clusterer.py

    if %errorlevel% neq 0 (
        echo [ERROR] PyInstaller завершился с ошибкой.
        pause
        exit /b 1
    )

    if exist "%RESOURCES_DIR%\clusterer.exe" (
        echo        clusterer.exe собран успешно!
        for %%F in ("%RESOURCES_DIR%\clusterer.exe") do echo        Размер: %%~zF байт
    ) else (
        echo [ERROR] clusterer.exe не найден после сборки.
        pause
        exit /b 1
    )
    echo.
) else (
    echo [2/5] Python пропущен — создаём заглушку...
    if not exist "%RESOURCES_DIR%" mkdir "%RESOURCES_DIR%"
    echo // placeholder > "%RESOURCES_DIR%\clusterer.placeholder"
    echo.
    echo [3/5] Сборка clusterer.exe пропущена.
    echo.
)

:: ── npm install ──────────────────────────────────────────────────────────────
echo [4/5] npm install...
call npm install --silent
if %errorlevel% neq 0 (
    echo [ERROR] npm install завершился с ошибкой.
    pause
    exit /b 1
)
echo        node_modules — OK
echo.

:: ── Electron Builder ─────────────────────────────────────────────────────────
echo [5/5] Сборка Electron (Win unpacked)...
if exist "%BUILD_DIR%" (
    echo        Очистка dist/...
    rd /s /q "%BUILD_DIR%"
)

:: Если clusterer.exe есть — собираем с ним, иначе патчим конфиг
if defined SKIP_PYTHON (
    :: Временно патчим package.json чтобы убрать extraResources
    %PYTHON_CMD% -c "import json; d=json.load(open('package.json')); d['build'].pop('extraResources',None); json.dump(d,open('package.json','w'),indent=2)" 2>nul
    call npx electron-builder --win --x64 --dir
) else (
    call npx electron-builder --win --x64 --dir
)

if %errorlevel% neq 0 (
    echo [ERROR] electron-builder завершился с ошибкой.
    pause
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║   ✓  Сборка завершена успешно!                      ║
echo ╠══════════════════════════════════════════════════════╣
echo ║   Папка: dist\win-unpacked\                         ║
if not defined SKIP_PYTHON (
echo ║   clusterer.exe: включён в resources\              ║
) else (
echo ║   clusterer.exe: НЕ включён (Python не найден)     ║
)
echo ╚══════════════════════════════════════════════════════╝
echo.

:: Открыть dist папку
start "" "%BUILD_DIR%"
pause
