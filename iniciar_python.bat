@echo off
title I.E. San Nicolás de Tolentino - Servidor RFID
chcp 65001 >nul
cls

echo ================================================================
echo   INSTITUCIÓN EDUCATIVA SAN NICOLÁS DE TOLENTINO
echo   CONTROL DE ASISTENCIA ESCOLAR RFID (ESP8266 + PYTHON)
echo ================================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontró Python en su sistema.
    echo Por favor instale Python 3 desde https://www.python.org/
    echo Recuerde marcar: [X] Add Python to PATH
    pause
    exit /b
)

echo [OK] Python detectado:
python --version
echo.

echo Su dirección IP local para configurar en el ESP8266 es:
for /f "tokens=4" %%a in ('route print^|findstr 0.0.0.0.*0.0.0.0^|findstr /v "255.255.255.255"') do (
    echo    >>> %%a
)
echo.
echo ================================================================
echo Servidor Oficial activo en: http://localhost:5000
echo Abriendo navegador automáticamente...
echo (Para detener el servidor presione Ctrl + C)
echo ================================================================
echo.

start "" "http://localhost:5000"

set PORT=5000
python servidor_simple.py

echo.
pause
