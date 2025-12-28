@echo off
title GoNature — Booking Form
cd /d "%~dp0"

echo ===========================================
echo   🚀 Запуск локального сервера формы
echo   Адрес: http://localhost:8080/booking/
echo ===========================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Python не найден.
    pause
    exit /b
)

REM Запускаем сервер из корня
start "" http://localhost:8080/booking/
python -m http.server 8080

pause
