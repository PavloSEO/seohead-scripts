@echo off
cd /d "%~dp0"
echo Installing dependencies for SEO Scripts...
echo (sharp requires native build — may take 1-2 min on first install)
echo.
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: Installation failed.
    echo Make sure Node.js 18+ is installed: https://nodejs.org
    pause
    exit /b 1
)
echo.
echo Done! Run start.bat to launch in dev mode.
echo Run build.bat to create installer.
pause
