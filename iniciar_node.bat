@echo off
title I.E. San Nicolás de Tolentino - Servidor Node.js RFID
chcp 65001 >nul
cls

echo ================================================================
echo   INSTITUCIÓN EDUCATIVA SAN NICOLÁS DE TOLENTINO
echo   CONTROL DE ASISTENCIA ESCOLAR RFID (NODE.JS + EXPRESS + VITE)
echo ================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontró Node.js en su sistema.
    echo Descargue e instale Node.js LTS desde: https://nodejs.org/
    pause
    exit /b
)

echo [OK] Node.js detectado:
node --version
npm --version
echo.

if not exist node_modules (
    echo [1/2] Instalando paquetes de Node.js...
    call npm install
)

echo.
echo Su dirección IP local para el ESP8266 es:
for /f "tokens=4" %%a in ('route print^|findstr 0.0.0.0.*0.0.0.0^|findstr /v "255.255.255.255"') do (
    echo    >>> %%a
)
echo.
echo ================================================================
echo Iniciando servidor en: http://localhost:5000
echo Abriendo navegador automáticamente...
echo (Para detener el servidor presione Ctrl + C)
echo ================================================================
echo.

start "" "http://localhost:5000"

set PORT=5000
call npx tsx server.ts

echo.
pause
