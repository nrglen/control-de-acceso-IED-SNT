@echo off
title Sistema de Asistencia Escolar RFID - Servidor Local
chcp 65001 >nul
cls

echo ================================================================
echo    SISTEMA DE ASISTENCIA ESCOLAR CON RFID (ESP8266 + SQLITE)
echo ================================================================
echo.

:: Verificar que esta instalado
set HAS_NODE=0
set HAS_PYTHON=0

where node >nul 2>nul
if %errorlevel% equ 0 set HAS_NODE=1

where python >nul 2>nul
if %errorlevel% equ 0 set HAS_PYTHON=1

if %HAS_NODE% equ 0 if %HAS_PYTHON% equ 0 (
    echo [ERROR] No se encontro ni Node.js ni Python en el sistema.
    echo.
    echo Para iniciar el servidor necesita al menos UNO de los dos:
    echo  - Opcion 1: Instalar Node.js LTS desde https://nodejs.org
    echo  - Opcion 2: Instalar Python 3 desde https://python.org (marcar 'Add to PATH')
    echo.
    pause
    exit /b
)

:: Si ambos estan disponibles, preguntar al usuario
if %HAS_NODE% equ 1 if %HAS_PYTHON% equ 1 (
    echo Se detectaron tanto Node.js como Python en su equipo.
    echo Elija con cual desea iniciar el servidor:
    echo.
    echo   [1] Iniciar con Node.js / Express (Recomendado - Interfaz Oficial Completa)
    echo   [2] Iniciar con Python (Servidor Todo en Uno)
    echo.
    set /p OPCION="Ingrese 1 o 2 (por defecto 1): "
    if "%OPCION%"=="2" goto RUN_PYTHON
    goto RUN_NODE
)

if %HAS_NODE% equ 1 goto RUN_NODE
if %HAS_PYTHON% equ 1 goto RUN_PYTHON

:RUN_PYTHON
echo.
echo ================================================================
echo [MODO PYTHON] Iniciando servidor Flask en puerto 5000...
echo ================================================================
call iniciar_python.bat
exit /b

:RUN_NODE
echo.
echo ================================================================
echo [MODO NODE.JS] Iniciando servidor Express en puerto 5000...
echo ================================================================
call iniciar_node.bat
exit /b
