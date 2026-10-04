# Sistema Web de Registro de Asistencia Escolar con RFID (ESP8266 + SQLite)

Sistema completo con backend real, base de datos SQLite persistente (`asistencia.db`), interfaz web en español y soporte para lectores RFID basados en **ESP8266 + RC522 (13.56 MHz)**.

---

## 📁 Archivos Principales del Proyecto

- `server.ts` : Backend principal en **Node.js / Express** con SQLite (`sql.js`), endpoints API REST y Vite integrado.
- `app.py` : Backend alternativo en **Python Flask** con SQLite y endpoints idénticos para quienes prefieran correr Python.
- `esp8266_rfid_asistencia.ino` : Firmware Arduino completo para ESP8266 (NodeMCU / Wemos D1 Mini) y RC522.
- `iniciar_servidor_windows.bat` : Script de 1-clic para iniciar automáticamente el servidor en Windows en el puerto 5000.
- `abrir_puerto_firewall.bat` : Script para abrir el puerto 5000 en el Firewall de Windows con 1 clic.
- `static/fotos/` : Directorio donde se almacenan las fotos de los estudiantes (subidas o tomadas con la cámara).
- `static/logo.svg` : Escudo institucional del colegio.

---

## ⚡ Guía Rápida para Ejecutar en Windows

### Requisitos Previos (Elegir Node.js o Python)
1. **Opción A (Recomendada - Node.js)**: Instalar [Node.js LTS](https://nodejs.org).
2. **Opción B (Python)**: Instalar [Python 3](https://python.org).

---

### Paso 1: Permitir el Puerto 5000 en el Firewall de Windows

Para que el ESP8266 pueda enviar lecturas por HTTP POST al computador dentro de la red Wi-Fi local, el Firewall de Windows debe permitir conexiones entrantes en el puerto 5000.

#### Método Automático (Recomendado):
1. Ubique el archivo **`abrir_puerto_firewall.bat`**.
2. Haga **clic derecho** sobre él y seleccione **"Ejecutar como Administrador"**.
3. Verá un mensaje verde confirmando la creación de la regla.

#### Método Manual por Símbolo del Sistema / PowerShell:
1. Abra **PowerShell** o **CMD** como Administrador.
2. Ejecute el siguiente comando:
   ```cmd
   netsh advfirewall firewall add rule name="Servidor Asistencia RFID Puerto 5000" dir=in action=allow protocol=TCP localport=5000
   ```

---

### Paso 2: Iniciar el Servidor en Windows (0.0.0.0:5000)

#### Con el script automático:
Haga doble clic en **`iniciar_servidor_windows.bat`**. El script detectará si tiene Node.js o Python y arrancará el servidor en el puerto 5000 escuchando en `0.0.0.0`.

#### Manualmente con Node.js:
```bash
# 1. Instalar dependencias
npm install

# 2. Compilar el frontend
npm run build

# 3. Iniciar el servidor en el puerto 5000
set PORT=5000
npm start
```

#### Manualmente con Python Flask:
```bash
# 1. Instalar dependencias
pip install flask flask-cors werkzeug

# 2. Iniciar servidor
python app.py
```

El servidor quedará escuchando en `http://0.0.0.0:5000`. Puede abrir su navegador en:
- Desde la misma computadora: `http://localhost:5000`
- Desde otros equipos o celulares en la misma red Wi-Fi: `http://<IP_DE_SU_PC>:5000`

---

## 🔌 Conexión del Hardware (ESP8266 + Lector RC522)

### Conexiones de Pines
| Pin del Lector RC522 | ESP8266 NodeMCU | Wemos D1 Mini | Notas |
| :--- | :--- | :--- | :--- |
| **3.3V (VCC)** | **3.3V** | **3.3V** | ⚠️ **¡NUNCA conectar a 5V! Quemará el módulo** |
| **RST (Reset)** | **D3** (GPIO 0) | **D3** | Reset |
| **GND** | **GND** | **GND** | Tierra común |
| **IRQ** | No conectado | No conectado | No requerido |
| **MISO** | **D6** (GPIO 12) | **D6** | SPI MISO |
| **MOSI** | **D7** (GPIO 13) | **D7** | SPI MOSI |
| **SCK** | **D5** (GPIO 14) | **D5** | SPI Clock |
| **SDA (SS)** | **D4** (GPIO 2) | **D4** | SPI Chip Select |
| **Buzzer (+)** *(Opcional)* | **D1** (GPIO 5) | **D1** | Zumbador acústico |

---

## 📡 Programación del ESP8266 en Arduino IDE

1. Abra **Arduino IDE**.
2. Instale la librería **MFRC522** (por GithubCommunity) desde el Gestor de Librerías.
3. Instale la librería **ArduinoJson** (por Benoit Blanchon, versión 6 o 7).
4. Abra el archivo `esp8266_rfid_asistencia.ino`.
5. Modifique las constantes con los datos de su red local:
   ```cpp
   const char* WIFI_SSID     = "MiRedWiFi";
   const char* WIFI_PASSWORD = "MiPassword123";
   const char* SERVER_IP   = "192.168.1.105"; // La IP local de su computadora
   const int   SERVER_PORT = 5000;
   const char* SALON_NAME  = "Salon-101";
   ```
6. Conecte el ESP8266 por USB, seleccione la placa (*NodeMCU 1.0 (ESP-12E Module)*) y el puerto COM correspondiente, y haga clic en **Subir**.

---

## 💡 Lógica de los Modos y Endpoints

### 1. `POST /api/lectura` (Usado por el ESP8266)
Body JSON enviado por el microcontrolador:
```json
{"uid": "A34F129C", "salon": "Salon-101"}
```
Respuesta garantizada:
```json
{"ok": true, "estado": "asistencia_registrada", "nombre": "Sofía Martínez Reyes"}
```

- **En Modo Asistencia**:
  - Si la tarjeta pertenece a un estudiante y no ha marcado hoy en ese salón: guarda asistencia y retorna `asistencia_registrada`.
  - Si ya marcó hoy en ese salón: no duplica y retorna `ya_registrada_hoy`.
  - Si la tarjeta no está registrada: guarda la lectura sin estudiante y retorna `tarjeta_no_registrada`.
- **En Modo Registro**:
  - **NUNCA** se marca asistencia.
  - Si la tarjeta no está registrada: se guarda como tarjeta pendiente y retorna `tarjeta_capturada`.
  - Si la tarjeta ya pertenece a un estudiante: retorna `tarjeta_ya_asignada` con su nombre para advertir al operador.

### 2. Pantalla Grande Kiosk (5 segundos)
Cuando el frontend detecta una nueva lectura en modo asistencia:
- **Verde**: "Asistencia registrada" (con foto, nombre y grado).
- **Amarillo**: "Ya registrada hoy" (aviso de registro previo).
- **Rojo**: "Tarjeta no registrada" (muestra el UID escaneado).

### 3. Registro Automático de Tarjetas
En la pestaña **Estudiantes**:
- Al hacer clic en **"Registrar tarjeta nueva"**, el servidor entra en modo registro durante 60 segundos con cuenta regresiva.
- Al acercar la tarjeta al lector ESP8266, el formulario detecta el UID automáticamente mediante `/api/tarjeta-pendiente` y lo rellena sin necesidad de escribirlo a mano.
- Al guardar el estudiante, el sistema regresa de inmediato al modo asistencia.

### 4. Seguridad de Administración
- Acceso protegido por contraseña predeterminada: `admin123`.
- Puede modificarse en cualquier momento desde la pestaña **ESP8266 & Windows**.
