@echo off
title Habilitar Puerto 5000 en Firewall de Windows para ESP8266
chcp 65001 >nul
cls
echo ================================================================
echo    HABILITAR PUERTO 5000 EN FIREWALL DE WINDOWS (PARA ESP8266)
echo ================================================================
echo.
echo Este script creara una regla de entrada en el Firewall de Windows
echo para permitir que el ESP8266 se comunique con el servidor en el puerto 5000.
echo.
echo [ATENCION] Se requieren privilegios de Administrador.
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Por favor haga clic DERECHO en este archivo y elija:
    echo        "Ejecutar como Administrador"
    echo.
    pause
    exit /b
)

echo Creando regla en el Firewall de Windows...
netsh advfirewall firewall delete rule name="Servidor Asistencia RFID Puerto 5000" >nul 2>&1
netsh advfirewall firewall add rule name="Servidor Asistencia RFID Puerto 5000" dir=in action=allow protocol=TCP localport=5000

if %errorlevel% equ 0 (
    echo.
    echo ================================================================
    echo [EXITO] ¡Puerto 5000 TCP habilitado correctamente en el Firewall!
    echo El ESP8266 podra conectarse libremente al servidor en la red local.
    echo ================================================================
) else (
    echo.
    echo [ERROR] No se pudo crear la regla en el Firewall. Verifique permisos.
)

echo.
pause
