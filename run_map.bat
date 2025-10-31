@echo off
title GoNature Map Server
cd /d "%~dp0"

echo ===========================================
echo   🚀 Запуск локального сервера карты...
echo   Путь: %CD%
echo   Адрес: http://localhost:8080/map/
echo ===========================================
echo.

REM Проверяем наличие Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Python не найден. Установи Python 3.x и добавь в PATH.
    pause
    exit /b
)

REM Запускаем сервер на порту 8080
start "" http://localhost:8080/map/
python -m http.server 8080
pause
